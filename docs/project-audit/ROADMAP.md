# Engineering Roadmap & Remediation Strategy — RentGoer

**Audit Date:** October 20, 2026  
**Auditor:** Principal Software Architect & Technical Auditor  
**Scope:** Actionable, prioritized recommendations organized from P0 (Immediate Critical) to P4 (Long-Term Enterprise).

---

## 1. Executive Summary & Prioritization Matrix

```
       HIGH IMPACT
            ^
            |   [P0: Logging & Env Validation]
            |   [P1: CI/CD & Error Tracking]     [P2: Redis SSE & Caching]
            |
            |   [P1: Vitest Migration]          [P3: Payments & Digital Leases]
            |   [P1: Email Alerts]
            |
            |   [P0: Orphan Dir Cleanup]        [P4: Monorepo & OpenAPI]
            +-------------------------------------------------------------> HIGH EFFORT
```

---

## 2. P0: Critical / Immediate Fixes (< 48 Hours)

### P0.1: Restrict Prisma Query Logging in Production
- **File:** `backend/src/lib/prisma.ts`
- **Problem:** `log: ['query', 'error', 'warn']` is hardcoded, printing every SQL query and parameter to stdout in production.
- **Remediation:**
  ```typescript
  export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn'] 
      : ['query', 'error', 'warn'],
  });
  ```
- **Impact:** Eliminates stdout bottleneck, decreases Render CPU usage by 15-25%, prevents parameter leakage in logs.
- **Effort:** 15 minutes.

### P0.2: Boot-Time Environment Variable Validation
- **File:** `backend/src/index.ts`
- **Problem:** If a required environment variable (e.g. `JWT_SECRET`, `DATABASE_URL`, `FRONTEND_URL`) is omitted in production, the application starts up and fails later during a live user request.
- **Remediation:** Introduce a startup check using `zod` or a strict assertion utility before mounting Express routes:
  ```typescript
  const requiredEnv = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'FRONTEND_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
      console.error(`FATAL: Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }
  ```
- **Effort:** 30 minutes.

### P0.3: Clean Up Malformed Directory
- **Target:** `frontend/src/app/chat/[id`
- **Action:** Remove the accidental directory left over from a typographical error.
- **Effort:** 5 minutes.

---

## 3. P1: Short-Term / Production Hardening (Weeks 1 – 3)

### P1.1: Automated CI/CD Pipeline (GitHub Actions)
- **Problem:** Code can currently be pushed directly to `main` with syntax errors, broken TypeScript types, or failing tests.
- **Remediation:** Add `.github/workflows/ci.yml`:
  1. Frontend lint (`npm run lint`) and type check (`tsc --noEmit`).
  2. Backend compile check (`tsc --noEmit`).
  3. Run core test suite.
- **Effort:** 1 day.

### P1.2: Error Monitoring & Telemetry (Sentry Integration)
- **Problem:** When an unhandled exception or 500 error occurs in production on Render or Vercel, there is no alerting mechanism; developers only find out if users report it.
- **Remediation:** Install `@sentry/node` on the backend and `@sentry/nextjs` on the frontend.
- **Effort:** 1 day.

### P1.3: Standardize Test Harness to Vitest
- **Problem:** 34 manual test scripts in `backend/scratch/` must be run individually using `tsx`.
- **Remediation:**
  1. Add `vitest` to `backend/devDependencies`.
  2. Move active tests from `scratch/` into `backend/tests/unit/` and `backend/tests/integration/`.
  3. Configure a single `npm test` command that executes cleanly in CI.
- **Effort:** 2–3 days.

### P1.4: Offline Transactional Email Notifications
- **Problem:** If a tenant or owner is not currently logged into the app with an active SSE connection, they receive no real-time notification of rental request acceptances, rejections, or chat messages.
- **Remediation:** Integrate an email service (Resend, SendGrid, or AWS SES) to dispatch transactional emails:
  - When rental request is submitted (alert owner).
  - When rental request is accepted or rejected (alert tenant).
  - When a message remains unread for >15 minutes (alert recipient).
- **Effort:** 2 days.

### P1.5: Standardize API Response and Error Contract
- **Problem:** Three different error payload structures exist across backend controllers.
- **Remediation:** Enforce a single API envelope:
  ```typescript
  type ApiResponse<T> = 
    | { success: true; data: T; message?: string }
    | { success: false; error: { code: string; message: string; details?: unknown } };
  ```
- **Effort:** 2 days.

---

## 4. P2: Medium-Term / Scalability & Performance (Weeks 4 – 8)

### P2.1: Distributed SSE via Redis Pub/Sub
- **Problem:** SSE connections are held in an in-memory `Map` on a single Node.js instance. RentGoer cannot horizontally scale to multiple Render instances without breaking real-time events.
- **Remediation:** Implement an `EventEmitter` backed by Redis Pub/Sub (e.g. Upstash Redis or AWS ElastiCache).
  - When a message or notification is published, it broadcasts across Redis to all running backend instances.
- **Effort:** 3–4 days.

### P2.2: Redis Session / TokenVersion Caching
- **Problem:** Every single authenticated request performs a PostgreSQL query to check `user.tokenVersion`.
- **Remediation:** Cache `user:{id}:tokenVersion` in Redis with a 5-minute TTL. Invalidate the cache key instantly upon logout or password change.
- **Impact:** Cuts database query load by 40–60%.
- **Effort:** 1–2 days.

### P2.3: Cloudflare CDN for Supabase Images
- **Problem:** Property images are requested directly from Supabase Storage URLs.
- **Remediation:** Route image requests through a Cloudflare custom domain with aggressive edge caching for static assets.
- **Effort:** 1 day.

### P2.4: Frontend Component Decomposition
- **Problem:** `frontend/src/app/chat/[id]/page.tsx` is over 700 lines.
- **Remediation:** Decompose into modular components: `ChatHeader`, `MessageList`, `MessageBubble`, `ChatInput`, `AttachmentPicker`.
- **Effort:** 2 days.

---

## 5. P3: Product & Feature Expansion (Months 2 – 4)

### P3.1: Digital Rental Agreements & E-Signatures
- **Capability:** Once an owner accepts a rental request, generate a standardized residential rental agreement PDF with tenant, owner, property, rent, and deposit details.
- **Implementation:** PDF generation via `@react-pdf/renderer` or `puppeteer`, e-signature confirmation via Aadhaar eSign or DocuSign API.

### P3.2: Rent & Security Deposit Payments (Razorpay / Stripe)
- **Capability:** In-app security deposit escrow and recurring monthly rent payment reminders via UPI / credit card.
- **Value:** Extends RentGoer from discovery/chat into transaction settlement.

### P3.3: Automated KYC / Identity Verification
- **Capability:** Replace manual admin identity verification with automated government ID OCR and validation (DigiLocker / Aadhaar API in India).

---

## 6. P4: Enterprise Architecture & Monorepo (Months 4+)

### P4.1: Shared Monorepo Tooling (Turborepo)
- Consolidate `frontend/` and `backend/` into a Turborepo or npm workspaces monorepo.
- Extract `packages/types` to share TypeScript interfaces between Prisma and Next.js frontend, preventing drift.

### P4.2: Automated OpenAPI / Swagger Specification
- Generate interactive API documentation from TypeScript controllers via `tsoa` or `zod-to-openapi`.
