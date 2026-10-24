# 08 — Reliability, performance & code quality

**Overall Security & Quality Status:** PARTIAL PASS (Backend npm audit retains 3 High-severity findings from unpatched Prisma 6 transitive dependency `deepmerge-ts@7.1.5`; production runtime isolation and all test suites verified)

## Confirmed milestones
- [x] Restrict Prisma query logging in production to prevent log flooding and parameter exposure (`backend/src/lib/prisma.ts:L10-14`, commit `b191164`) — fixes audit P0.1
- [x] In-flight request deduplication on frontend client (`frontend/src/lib/api.ts:L8-13`) eliminating mounting waterfalls
- [x] Batch `groupBy` review rating and count aggregation (`backend/src/controllers/property.controller.ts:L100-128`) preventing N+1 queries
- [x] Component and context memoization (`useMemo`, `useCallback`) across Auth, Favorites, and Notification contexts (`frontend/src/context/`)
- [x] Startup safety validation for JWT and session configuration (`backend/src/config/auth.config.ts`, `backend/src/index.ts:L33`)
- [x] SEC-01: Property image upload hardening with magic-byte validation and strict raster allowlist (`backend/src/lib/image-validator.ts`, `backend/src/controllers/property-image.controller.ts`) preventing arbitrary MIME spoofing
- [x] SEC-02: Isolated Playwright E2E configuration disabling server reuse (`reuseExistingServer: false`) with dedicated test ports (backend: 5001, frontend: 3100)
- [x] SEC-03: E2E remote isolation controls: fail-closed backend URL guard (`frontend/src/lib/backend-guard.ts`) and Next.js Image Optimizer route interception (`frontend/tests/e2e/fixtures.ts`) preventing unintended Supabase egress
- [x] SEC-04: Test infrastructure module resolution fix ensuring TypeScript test context resolution (`test-db-context.ts`) and fail-closed local test DB isolation (`test-db-guard.ts`)
- [x] SEC-05 Phase 1: Remediate backend runtime production dependency vulnerabilities (`multer` to 2.5.0, `body-parser` to 2.4.0, `ip-address` to 10.7.4)
- [x] SEC-05 Phase 2: Remediate frontend Vitest toolchain vulnerabilities (`vitest` upgraded to 4.1.12, removing vulnerable `tinypool`, resolving all frontend audit findings to 0)
- [x] SEC-05 Phase 3: Backend Prisma tooling audit and compatibility review: verified production server (`node dist/index.js`) does not load `@prisma/config` or `deepmerge-ts`; identified Render build CLI requirement

## Remaining & proposed items
- [ ] Add structured logging (Pino/Winston) and error tracking telemetry (Sentry integration)
- [ ] Add server-side request validation with a schema library such as Zod
- [ ] Implement generic boot-time environment variable validation in `backend/src/index.ts` for all required variables (`DATABASE_URL`, `FRONTEND_URL`, etc. — P0.2)
- [ ] Delete accidental typographical orphan directory `frontend/src/app/chat/[id` (P0.3)
- [ ] Standardize API response and error envelopes across all backend controllers (`CODE_QUALITY.md:L58-63`)
- [ ] Enhance `frontend/src/lib/api.ts` to support multipart `FormData` so `PropertyForm.tsx` does not bypass the API client (`CODE_QUALITY.md:L52-57`)
- [ ] Decompose monolithic frontend components: `frontend/src/app/chat/[id]/page.tsx` (654 lines) and `Navbar.tsx` (617 lines) (`CODE_QUALITY.md:L65-73`)
- [ ] Add 20-second keepalive pings to Notification SSE stream to match Chat SSE and prevent proxy idle drops (`PERFORMANCE.md:L79-80`)
- [ ] Review dependency/runtime compatibility and pin a supported Node.js LTS version
- [ ] Re-check API query performance and add recommended composite indexes (e.g., `Property(isVerified, createdAt)`)
- [ ] Reassess SSE behavior under multiple backend instances: evaluate Redis Pub/Sub before horizontal container scaling
- [ ] Evaluate Redis caching for `user.tokenVersion` to reduce database point lookups on authenticated requests
- [ ] Add transactional email delivery (Resend / SendGrid) for offline lifecycle notifications

## Verified controls & test results
- **Frontend Security Audit**: `npm audit --json` reports **0 vulnerabilities**.
- **Frontend Unit Tests**: `npm test` passes **10/10 files**, **108/108 tests** (7.24s).
- **Frontend Type Check**: `npx tsc --noEmit` passes with **0 type errors**.
- **Frontend Production Build**: `npm run build` compiles **all 20 static/dynamic routes** successfully.
- **Playwright E2E Suite**: `npm run test:e2e` passes **24/24 tests** (25.0s) with test backend on isolated port 5001 and frontend on port 3100.
- **Backend Unit Tests**: `npm test` passes **13/13 files**, **231/231 tests** (799ms).
- **Backend Session Unit Tests**: `npm run test:session:unit` passes **30/30 offline tests**.
- **Backend Database Integration Tests**: `npm run test:integration` passes **3/3 files**, **17/17 tests** (1.15s) against local `rentgoer_test` database (port 5432).
- **Session Postgres Integration**: `npm run test:session:integration` passes all real PostgreSQL concurrent and revocation scenarios.
- **Backend Production Build**: `npm run build` (`tsc`) compiles cleanly with **0 errors**.
- **Runtime Module Isolation Trace**: Both AST inspection of `backend/dist` and empirical Node.js module cache tracing (`require.cache`) confirm `@prisma/client` loads independently without importing or loading `@prisma/config` or `deepmerge-ts`.

## Residual risk & audit findings
- **Backend Audit Findings**: `npm audit --json` in `backend/` retains **3 High-severity entries**:
  - `deepmerge-ts@7.1.5` (GHSA-ggr8-5vv4-36mx, CWE-674: Stack Exhaustion when merging recursive object graphs)
  - `@prisma/config@6.19.3` (transitive via `deepmerge-ts`)
  - `prisma@6.19.3` (transitive via `@prisma/config`)
- **Upstream Patch Status**: No patched Prisma 6 release exists; Prisma 6 reached end-of-life at `6.19.3`. The upstream fix is only available in Prisma 7.10.1+ (`isSemVerMajor: true`).
- **Production Runtime Posture**: The remaining vulnerability is reported as isolated from normal production HTTP handling because `node dist/index.js` executes `@prisma/client`, and the project contains no `prisma.config.*` file. However, because the package remains installed in `node_modules` and executes during CLI tasks, absolute unreachability or zero risk across all operational contexts cannot be claimed.
- **E2E Egress Boundary Limitation**: Playwright route interception operates at the browser network layer and intercepts client requests (including Next.js image proxy calls). It does **not** function as an OS-level or kernel-level server-side egress firewall for Node.js backend processes.
- **Deployment Constraints**: Render blueprint (`backend/render.yaml`) specifies `buildCommand: npm install && npx prisma generate && npm run build` with `NODE_ENV=production`. Moving `prisma` from `dependencies` to `devDependencies` would cause `npm install` to omit the CLI, breaking the build.

## Deferred work
- **Prisma Major Version Migration**: Plan and execute a dedicated migration to **Prisma 7.10.1+** (or Prisma 8 LTS) to resolve `deepmerge-ts`, accompanied by thorough schema, query engine, and driver adapter regression testing.
- **Stronger Server-Side Egress Isolation**: Investigate network namespace or container-level egress firewalling for automated test pipelines to complement browser-level interception.
- **Deployment Build Decoupling**: If multi-stage Docker builds or `--include=dev` flags are adopted in hosting configuration, relocate `prisma` and `typescript` from `dependencies` to `devDependencies`.


