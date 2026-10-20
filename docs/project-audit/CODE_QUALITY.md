# Code Quality, Maintainability & Technical Debt Audit — RentGoer

**Audit Date:** October 20, 2026  
**Auditor:** Senior Technical Documentation Auditor & Repository Verification Engineer  
**Scope:** Architectural cleanliness, consistency, anti-patterns, code smells, dead code, orphan files, and maintainability recommendations.

---

## 1. Overall Code Quality Rating

| Category | Score | Assessment | Confidence |
|---|---|---|---|
| **Architecture & Separation** | 8.5 / 10 | Well-structured layered architecture: Routes -> Middleware -> Controllers -> Prisma -> DB. | **[Verified in source]** |
| **Type Safety** | 8.5 / 10 | Strict TypeScript usage across backend models and frontend components. | **[Verified in source]** |
| **Error Handling** | 7.0 / 10 | Comprehensive try/catch blocks and HTTP status codes, but response envelopes vary. | **[Verified in source]** |
| **Consistency** | 7.5 / 10 | Consistent use of `api` helper across almost all pages, except multipart uploads. | **[Verified in source]** |
| **Production Readiness** | 7.0 / 10 | Verbose query logging in Prisma; in-process EventEmitters prevent horizontal scaling. | **[Verified in source]** |
| **Repository Cleanliness** | 6.0 / 10 | 34 scratch scripts in root, malformed orphan directory `frontend/src/app/chat/[id`. | **[Verified in source]** |

---

## 2. Codebase Strengths

1. **Transactional Integrity on Critical State (`rental-request.controller.ts`):**
   - In `acceptRequest`, the operation uses `prisma.$transaction` to guarantee that updating the target request, rejecting competing requests, locking the property availability, and creating/linking the conversation happen atomically **[Verified in source]**.
2. **Robust Session Revocation (`auth.middleware.ts`):**
   - Clear distinction between authentication tokens (JWT in HttpOnly cookies) and user revocation tracking (`tokenVersion` in PostgreSQL). Stale tokens are rejected instantly across all devices **[Verified in source]**.
3. **Explicit RBAC Protection (`role.middleware.ts`):**
   - Role verification middlewares (`requireRole('OWNER')`, `requireRole('TENANT')`, `requireRole('ADMIN')`) are applied strictly across administrative and owner-specific routes **[Verified in source]**.
4. **Resilient Real-time Fallback (`useConversationRealtime.ts`):**
   - The frontend's chat connection does not fail silently if SSE drops; it automatically activates a 5-second polling fallback (`/conversations/:id/messages?after=...`) to keep messages flowing until reconnection **[Verified in source]**.
5. **In-Flight Request Deduplication (`frontend/src/lib/api.ts`):**
   - The client-side `api.get` helper deduplicates concurrent GET requests to identical URLs using an in-flight Promise map, eliminating mounting waterfalls **[Verified in source]**.

---

## 3. Key Inconsistencies & Anti-Patterns

### 3.1 Unconditional Query Logging in Production (`backend/src/lib/prisma.ts`)
```typescript
// backend/src/lib/prisma.ts (Line 9)
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query', 'error', 'warn'], // <--- ANTI-PATTERN IN PRODUCTION
});
```
- **Impact:** Emits every single SQL statement and parameter list to stdout **[Verified in source]**. On Render or other cloud services, this degrades Node.js event-loop throughput, inflates log storage costs, and risks logging sensitive user data.
- **Remediation:** Restrict `query` logging to development mode only:
  ```typescript
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn']
  ```

### 3.2 Multipart Form-Data Upload Bypass in Frontend
- The project defines a clean centralized fetch helper in `frontend/src/lib/api.ts` (`api.get`, `api.post`, `api.put`, `api.patch`, `api.delete`) **[Verified in source]**.
- **Observation:** `api.ts` hardcodes `'Content-Type': 'application/json'` and `JSON.stringify(body)`.
- Consequently, `frontend/src/components/property/PropertyForm.tsx` (line 132) must bypass `api.ts` and use raw `fetch` to submit multipart `FormData` for image uploads **[Verified in source]**.
- **Fix:** Enhance `api.ts` to detect `FormData` payloads and omit the manual `Content-Type` header so the browser sets the boundary automatically.

### 3.3 Disparate API Error Schemas
Across backend controllers, error responses follow three conflicting formats **[Verified in source]**:
1. Format A (standard): `{ success: false, message: "Error description" }`
2. Format B: `{ error: "Error description" }`
3. Format C (Express global error handler): `{ message: "...", error: err.message }`
- **Impact:** The frontend must implement defensive fallbacks (`err.message || data.error || "An error occurred"`) instead of relying on a predictable contract.

### 3.4 Monolithic Frontend Components
Several frontend page files have grown exceptionally large:
- `frontend/src/app/chat/[id]/page.tsx`: **26.4 KB (654 lines)** **[Verified in source]**.
  - Combines conversation listing, message rendering, message submission, optimistic message reconciliation, container-scoped scrolling, and status badges in a single file.
- `frontend/src/components/layout/Navbar.tsx`: **29.6 KB (617 lines)** **[Verified in source]**.
  - Combines desktop nav, mobile slide-out drawer, role-based sub-menus, search shortcut, and three badge counters in one file.
- `frontend/src/app/owner/page.tsx`: **12.9 KB (380 lines)** **[Verified in source]**.
- **Recommendation:** Decompose these into focused sub-components (`ChatHeader`, `MessageList`, `ChatInputBar`, `NavBadges`, `MobileNavDrawer`).

### 3.5 Type Duplication Between Backend and Frontend
- Frontend defines `frontend/src/types/index.ts` with custom interfaces (`Property`, `User`, `RentalRequest`, `Message`) **[Verified in source]**.
- Backend defines Prisma generated types in `@prisma/client` **[Verified in source]**.
- When schema fields change, frontend types must be maintained manually, creating risk of silent runtime drift.

---

## 4. Repository Cleanliness & Dead Code

### 4.1 Malformed Typographical Directory: `frontend/src/app/chat/[id`
A typographical accident created the folder path:
```
frontend/src/app/chat/
  ├── [id]/      (Active dynamic route: page.tsx)
  └── [id/       (MALFORMED ORPHAN DIRECTORY)
      └── ]/     (Empty nested directory)
```
- **Verified Status:** `frontend/src/app/chat/[id/]` contains an empty directory named `]` **[Verified in source]**.
- **Remediation:** Safely delete `frontend/src/app/chat/[id` from the filesystem.

### 4.2 Cluttered `backend/scratch/` Directory
The `backend/scratch/` directory contains 34 scripts totaling over 250 KB of code **[Verified in source]**:
- One-off temporary scripts like `fix-ts.ts`, `check-admin-users.ts`, `test.ts`, and `owner_requests.ts` remain committed alongside active tests.
- **Remediation:** Relocate active test scripts into a structured `backend/tests/` directory and purge one-off scratch scripts.

### 4.3 Missing Backend Linter Configuration
- `frontend` configures ESLint 9 (`eslint-config-next`) **[Verified in source]**.
- `backend` has **no ESLint configuration file** and no `lint` script in `backend/package.json` **[Verified in source]**.

---

## 5. Security & Robustness Polish Items

| Area | Current Behavior | Recommended Enhancement | Confidence |
|---|---|---|---|
| **CORS Validation** | Checks `process.env.FRONTEND_URL` strictly | Add support for Vercel preview deployment URL patterns via regex. | **[Verified in source]** |
| **CSRF Protection** | Relies on `SameSite=Lax` cookies via proxy | Implement double-submit CSRF cookie or `X-Requested-With` header verification on mutating routes. | **[Verified in source]** |
| **Rate Limiter Storage** | In-memory `express-rate-limit` | Back with Redis (`rate-limit-redis`) for cluster-wide enforcement. | **[Verified in source]** |
| **File Upload Storage** | In-memory Multer buffer before upload | Stream directly to Supabase storage to reduce Node.js memory footprint on concurrent 5MB uploads. | **[Verified in source]** |
