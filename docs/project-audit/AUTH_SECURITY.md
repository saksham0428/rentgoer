# Authentication and Security Audit — RentGoer

---

## Authentication Flow

### Registration (POST /api/auth/register)
1. Validate name, email format, password >= 8 chars
2. Block ADMIN role registration (returns 403)
3. Normalize email: email.toLowerCase().trim()
4. Check for existing user by normalized email (409 on duplicate)
5. bcrypt.hash(password, 10) — 10 salt rounds
6. Create User record (passwordHash stored, never returned)
7. generateTokenAndSetCookie: jwt.sign({id, role, tokenVersion}, JWT_SECRET, expiresIn:7d)
8. Set HttpOnly cookie: name=rentgoer_token, httpOnly=true, secure=true (production), sameSite=lax, maxAge=7 days
9. Return user object (no passwordHash)

### Login (POST /api/auth/login)
1. Normalize email
2. Find user by normalized email
3. bcrypt.compare(inputPassword, user.passwordHash)
4. On success: generateTokenAndSetCookie with current tokenVersion
5. Return user object (id, name, email, role, phone, isVerified, createdAt — no passwordHash)

### Authentication Middleware (every protected request)
auth.middleware.ts:
1. Read token from req.cookies.rentgoer_token
2. jwt.verify(token, JWT_SECRET) — validates signature and expiry
3. DB query: prisma.user.findUnique({select: id, role, tokenVersion})
4. Compare decoded.tokenVersion === user.tokenVersion — reject if stale
5. Set req.user = { id, role }
6. next()

### Logout (POST /api/auth/logout)
- Clears rentgoer_token cookie (httpOnly, secure, sameSite:lax flags matched)
- Does NOT increment tokenVersion — other sessions remain valid until token expiry (7 days)
- This is a known limitation: logout only clears the current browser's cookie

### Session Revocation
- tokenVersion is incremented atomically when: password is changed, email is changed
- Any JWT with a stale tokenVersion is rejected by auth middleware
- This provides server-side session invalidation without a token blacklist

### Password Change
- Verifies current password before allowing change
- Hashes new password with bcrypt (10 rounds)
- Atomically: update passwordHash + increment tokenVersion in one DB update
- Clears current browser cookie — requires re-login

### Email Change
- Verifies current password before allowing change
- Checks new email not already in use
- Atomically: update email + increment tokenVersion
- Re-issues cookie for current session with new tokenVersion

### Role-Based Access Control
- requireRole(...roles) middleware: checks req.user.role against allowed roles
- Applied per-route in route files
- Examples:
  - OWNER only: create/edit/delete property, accept/reject/complete requests, upload images
  - TENANT only: add/remove favorites, create rental requests, create reviews
  - ADMIN only: all /api/admin/* routes
  - Any authenticated: send messages, view conversations, create reports

---

## Security Findings

### MEDIUM — tokenVersion DB Lookup on Every Request
Every authenticated request to the backend triggers a DB query to validate tokenVersion.
This is correct behavior for server-side session revocation, but means the auth middleware has O(n) latency per request proportional to DB round-trip time.
Evidence: auth.middleware.ts L23-30
Remediation: For high-frequency paths (SSE keepalive), a short-lived in-memory cache (e.g., 30-60s TTL) for tokenVersion could reduce DB load without meaningfully increasing revocation lag.

### MEDIUM — SSE State Is In-Memory Only
chatEventEmitter and notificationEventEmitter are Node.js EventEmitters in-process (lib/realtime.ts, lib/realtime-notifications.ts).
On Render restart, all SSE listeners are lost. Connected users will not receive events until they reconnect.
For a single backend instance, this is functional. On horizontal scaling (multiple Render instances), events emitted by instance A will not reach clients connected to instance B.
Evidence: lib/realtime.ts and lib/realtime-notifications.ts — no external pub/sub.
Remediation: Redis Pub/Sub, Supabase Realtime, or similar external message bus.

### LOW — Prisma Query Logging in Production
prisma.ts: log: ['query', 'error', 'warn'] is always enabled regardless of NODE_ENV.
In production, this logs every SQL query to stdout, which can expose table data in server logs.
Evidence: backend/src/lib/prisma.ts L9
Remediation: Conditionally enable query logging only when NODE_ENV !== 'production'.

### LOW — No CSRF Protection
The application uses SameSite=Lax cookies, which prevents CSRF on simple cross-site navigations (GET, top-level navigation).
However, Lax does not prevent CSRF on same-site POST requests in certain edge cases (e.g., a form on another site).
The Next.js proxy architecture reduces the attack surface significantly (cookies are only sent to Vercel domain), but explicit CSRF token protection is not implemented.
Evidence: auth.controller.ts, index.ts — no CSRF middleware.
Remediation: Add CSRF token to state-mutating requests, or rely on CORS + SameSite=Strict (more restrictive).

### LOW — Supabase Storage Bucket Policy Unverifiable from Code
The Supabase storage bucket `property-images` is used for property images.
The backend uses SERVICE_ROLE_KEY which bypasses RLS, but bucket-level access policies (public vs. private, allowed upload methods) are configured in the Supabase dashboard and cannot be verified from source code.
If the bucket is misconfigured as public-write, external parties could upload files directly.
Evidence: backend/src/config/supabase.ts — no bucket policy configuration in code.
Remediation: Verify in Supabase dashboard that bucket allows only authenticated server reads and that public upload is disabled.

### LOW — Logout Does Not Invalidate Other Sessions
POST /auth/logout only clears the calling browser's cookie. Other active sessions (other browsers/devices) remain valid until the 7-day JWT expires.
This is a product design choice with a usability trade-off. The tokenVersion pattern supports full revocation on password/email change.
Evidence: auth.controller.ts L151-162
Remediation: Consider an explicit "revoke all sessions" action that increments tokenVersion.

### LOW — Information in 401 Error Messages
auth.middleware.ts returns different messages for different failure conditions (no token, user not found, stale tokenVersion, invalid token). This is slightly more information than the minimum needed, though none of it is exploitable in isolation.
Evidence: auth.middleware.ts L11, L33, L39, L50
Remediation: Collapse to a single "Unauthenticated" message for all 401 paths.

### LOW — No Rate Limiting on GET Endpoints
Auth endpoints have a 50/15min limiter. All other endpoints share 1000/15min.
SSE endpoints (/notifications/realtime, /conversations/:id/realtime) are long-lived connections. The rate limiter applies to the initial connection request but not the stream duration.
SSE connection limits per user (3 notification, 5 chat) are implemented in sse-tracker.ts.
Evidence: index.ts L51-59, auth.routes.ts L16-32

### INFORMATIONAL — No Email Verification
Accounts can be created with any email address without verifying ownership.
A bad actor could register with someone else's email.
Remediation: Add email verification step (requires email service integration).

---

## CORS Configuration

- CORS is configured with a single allowed origin: process.env.FRONTEND_URL
- credentials: true is set (required for cookie forwarding)
- No wildcard (*) origin is permitted
- Evidence: index.ts L46-49
- The frontend only talks to the Next.js proxy which talks to the backend, so direct browser CORS is not the primary attack surface.

## Cookie Security Summary

| Property | Development | Production |
|---|---|---|
| httpOnly | true | true |
| secure | false | true |
| sameSite | lax | lax |
| maxAge | 7 days | 7 days |
| name | rentgoer_token | rentgoer_token |

## Secret Management

Environment variables used (names only, no values):
- JWT_SECRET — must be strong random string
- DATABASE_URL — Supabase connection string with pooler
- DIRECT_URL — Supabase direct connection for migrations
- SUPABASE_URL — Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY — admin key, bypasses RLS
- FRONTEND_URL — for CORS origin
- PORT — server port

.env is in backend/.gitignore (confirmed). .env.example documents all required variables without secrets.

## Database Access Architecture

- All database access goes through Prisma (no raw SQL except health check SELECT 1)
- The SERVICE_ROLE_KEY is only used in the backend for Supabase Storage operations
- Supabase's public anon API is NOT exposed to clients
- No direct client-to-database connections
