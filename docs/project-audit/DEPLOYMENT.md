# Deployment & Infrastructure Audit — RentGoer

**Audit Date:** October 20, 2026  
**Auditor:** Senior Technical Documentation Auditor & Repository Verification Engineer  
**Scope:** Hosting topologies, cross-origin networking, cookie isolation, database connection pooling, build lifecycles, and failure recovery.

---

## 1. Production Architecture Topology

RentGoer employs a decoupled, multi-cloud hosting topology:

```
[ End User Browser ]
       |
       |  HTTPS (Port 443)
       v
[ Vercel Edge Network ]
  - Hosts: Next.js 16 (React 19) App Router [Verified in source]
  - Domain: https://rentgoer.vercel.app [Unverified live DNS/uptime]
  - Functions: Static Asset Serving, SSR, API Rewrites / Proxy
       |
       |  Internal Proxy Route: /api/proxy/*
       |  HTTPS (Port 443) with forwarded cookies and headers [Verified in source]
       v
[ Render Web Service ]
  - Hosts: Node.js 20+ Express Backend [Verified in source]
  - Domain: https://rentgoer.onrender.com (or rentgoer-api.onrender.com) [Unverified live instance]
  - Functions: REST API, Real-Time SSE Stream Engine, Multer Ingestion
       |
       +------------------------------------+
       |                                    |
       v (Port 6543 - PgBouncer)            v (Port 443 - REST API)
[ Supabase PostgreSQL ]             [ Supabase Storage ]
  - Pooled: DATABASE_URL              - Bucket: `property-images` [Verified in source]
  - Direct: DIRECT_URL (Port 5432)    - Uploads via Service Role Key [Verified in source]
  - 13 Prisma Migrations              - 5MB per image limit [Verified in source]
```

---

## 2. The Cross-Domain Cookie Architecture & API Proxy

### The Architectural Problem
The frontend is configured for deployment on Vercel (`rentgoer.vercel.app`) and the backend on Render (`rentgoer.onrender.com`). Because web browsers treat `.vercel.app` and `.onrender.com` as entirely separate public suffixes (eTLD+1), direct requests between them are classified as **Cross-Site** **[Verified in source]**.

If the browser were to make direct fetch calls from Vercel to Render:
1. `SameSite=Lax` cookies are stripped from cross-site XHR/Fetch calls by default.
2. If `SameSite=None` were used, modern browsers with third-party cookie restrictions (Safari ITP, Chrome Privacy Sandbox) would block the cookie entirely unless complex storage access permissions were granted.
3. The auth cookie `rentgoer_token` would never arrive at the backend.

### The Production Solution: Next.js Rewrite Proxy
RentGoer resolves this cleanly via Next.js Server-Side Rewrites in `frontend/next.config.ts` **[Verified in source]**:
```ts
async rewrites() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  return [
    {
      source: "/api/proxy/:path*",
      destination: `${backendUrl}/api/:path*`,
    },
  ];
}
```
**Mechanism:**
1. The browser sends all requests to `https://rentgoer.vercel.app/api/proxy/...` **[Verified in source]**.
2. Because the request destination is on the **exact same origin** (`rentgoer.vercel.app`), the browser attaches the `rentgoer_token` cookie without cross-site restrictions **[Verified in source]**.
3. The Vercel edge server proxies the incoming HTTP stream to Render, preserving the `Cookie` header **[Verified in source]**.
4. Render processes the request, inspects `req.cookies.rentgoer_token`, and issues `Set-Cookie` in response, which Vercel forwards transparently to the browser **[Verified in source]**.

---

## 3. Environment Variables Matrix

### Backend Environment Configuration

| Variable | Required in Prod | Production Setting / Source | Purpose | Confidence |
|---|---|---|---|---|
| `PORT` | Auto (Render) | `5000` | Port Express binds to. | **[Verified in source]** |
| `NODE_ENV` | Yes | `production` | Enables Secure cookies, disables query logging if patched. | **[Verified in source]** |
| `FRONTEND_URL` | Yes | `https://rentgoer.vercel.app` | Strictly configured in CORS middleware (no wildcards). | **[Verified in source]** |
| `DATABASE_URL` | Yes | `postgresql://postgres:[PWD]@...pooler.supabase.com:6543/postgres?pgbouncer=true` | PgBouncer transaction-pooled connection string. | **[Verified in source]** |
| `DIRECT_URL` | Yes | `postgresql://postgres:[PWD]@...supabase.com:5432/postgres` | Direct connection required for Prisma schema migrations. | **[Verified in source]** |
| `JWT_SECRET` | Yes | `[Secure random string]` | HMAC SHA256 secret for signing auth tokens. | **[Verified in source]** |
| `SUPABASE_URL` | Yes | `https://[project-id].supabase.co` | Supabase API endpoint. | **[Verified in source]** |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJhbGciOi...` | Bypasses RLS to manage `property-images` storage bucket. | **[Verified in source]** |
| `AUTH_RATE_LIMIT_MAX` | Optional | `50` (default) | Maximum auth attempts per 15-minute window per IP. | **[Verified in source]** |
| `API_RATE_LIMIT_MAX` | Optional | `1000` (default) | Maximum general API calls per 15-minute window. | **[Verified in source]** |
| `NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER` | Optional | `3` (default) | Caps concurrent notification streams per user ID. | **[Verified in source]** |
| `CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER` | Optional | `5` (default) | Caps concurrent chat streams per user ID. | **[Verified in source]** |

### Frontend Environment Configuration

| Variable | Required in Prod | Production Setting | Purpose | Confidence |
|---|---|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | `https://rentgoer.onrender.com` | Upstream destination for `/api/proxy/*` rewrite. | **[Verified in source]** |
| `NEXT_PUBLIC_API_URL` | Optional | `/api/proxy` (default fallback) | Base client URL used by `api` helper (`api.ts`). | **[Verified in source]** |

---

## 4. Build, Provisioning, and Migration Pipelines

### Build Pipeline Specifications

#### Frontend (Vercel)
- **Root Directory:** `frontend`
- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output:** `.next` standalone / edge bundle **[Verified in source]**.
- **Node.js Engine:** Node 20.x or 22.x.

#### Backend (Render)
- **Root Directory:** `backend`
- **Environment:** Node
- **Build Command:** `npm install && npx prisma generate && npm run build` **[Verified in source]**.
- **Start Command:** `npm start` (`node dist/index.js`) **[Verified in source]**.

### Admin User Provisioning Pipeline
Because public registration strictly blocks `ADMIN` role creation, admin accounts must be provisioned via the CLI script **[Verified in source]**:
```bash
# In production (via Render Shell or one-off task):
npm run admin:provision:dist -- --email admin@rentgoer.com --name "System Administrator" --password "SecurePassword123!"
```
**Features of the Provisioner:**
- Validates password entropy (minimum 8 chars, mixed case, numbers) **[Verified in source]**.
- Uses `bcrypt` with salt round 12 **[Verified in source]**.
- Idempotent: If user exists, upgrades role to `ADMIN` and resets password securely without creating orphan duplicate accounts **[Verified in source]**.

### Database Migration Protocol
Supabase utilizes PgBouncer for transaction pooling on port 6543. PgBouncer does **not** support Prisma's schema migration advisory locks.
- **Rule:** Migrations must ALWAYS run against `DIRECT_URL` (Port 5432) **[Verified in source]**.
- **Production Execution:**
  ```bash
  npx prisma migrate deploy
  ```
- **Prohibited:** Never execute `npx prisma migrate dev` or `npx prisma migrate reset` in production, as this drops schema tables and causes catastrophic data loss.

---

## 5. Server-Sent Events (SSE) on Render: Operational Realities

1. **Statefulness on In-Memory Nodes:**
   - Active client connections are maintained in Node.js `EventEmitter` instances and tracked by `sseTracker` in memory **[Verified in source]**.
   - **Render Free Tier Caveat:** Free tier instances spin down after 15 minutes of inactivity. When spinning down or restarting, all SSE connections drop. The client reconnects automatically via browser EventSource, and active chat engages a 5-second polling fallback **[Verified in source]**.
   - **Horizontal Scaling Caveat:** If the backend is scaled to multiple container instances, an SSE connection on Instance A will not receive a message emitted by a request handled by Instance B. A distributed Pub/Sub layer (e.g. Redis or Supabase Realtime) is required prior to horizontal scaling **[Inferred]**.
2. **Reverse Proxy Buffering:**
   - Render's reverse proxy does not buffer chunked transfer encoding when `X-Accel-Buffering: no` and `Content-Type: text/event-stream` headers are emitted. Both headers are explicitly set by RentGoer's chat SSE controller **[Verified in source]**.

---

## 6. Health & Verification Protocol

### Verification Endpoint (`GET /api/health`)
Returns:
```json
{
  "status": "ok",
  "message": "Backend and database are running successfully"
}
```
Performs an active database ping (`prisma.$queryRaw` `SELECT 1`) to guarantee DB connectivity before returning HTTP 200 (or 503 if DB fails) **[Verified in source]**.

### Automated Smoke Verification
The repository contains an automated production smoke test script at `backend/scratch/smoke-test-production.ts` **[Verified in source]**:
```bash
npx tsx scratch/smoke-test-production.ts
```
Verifies health, registration, login, property querying, and SSE endpoint connectivity against a target base URL.

---

## 7. Production Deployment Checklist

### Pre-Deployment
- [ ] Confirm all 13 Prisma migrations are committed in `backend/prisma/migrations/` **[Verified in source]**.
- [ ] Ensure `DATABASE_URL` uses port 6543 (`?pgbouncer=true`) and `DIRECT_URL` uses port 5432 **[Verified in source]**.
- [ ] Confirm Supabase `property-images` storage bucket exists and is set to public read access **[Unverified - requires Supabase dashboard]**.
- [ ] Verify `JWT_SECRET` is at least 32 bytes (64 hex characters) and unique to production **[Unverified - requires Render dashboard]**.

### Deployment Steps
1. Push branch to GitHub `main` / `master`.
2. Vercel automatically deploys the frontend.
3. Render automatically executes backend build (`npm install && npx prisma generate && npm run build`).
4. Execute `npx prisma migrate deploy` via Render deploy hook or CLI shell.
5. If initializing a fresh system, run `npm run admin:provision:dist` to establish the root administrator.

### Post-Deployment Verification
- [ ] Query `GET https://rentgoer.onrender.com/api/health` — confirm `"status": "ok"` and database connectivity **[Unverified]**.
- [ ] Visit `https://rentgoer.vercel.app/` — verify landing page loads with no console CORS errors **[Unverified]**.
- [ ] Perform a test registration and verify `rentgoer_token` cookie is stored with `HttpOnly` and `SameSite=Lax` **[Unverified]**.
- [ ] Inspect network tab: confirm `/api/proxy/notifications/realtime` remains in `Pending / EventStream` status without 502/504 timeouts **[Unverified]**.
