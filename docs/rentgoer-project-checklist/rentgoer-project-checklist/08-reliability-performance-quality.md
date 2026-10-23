# 08 — Reliability, performance & code quality

## Confirmed milestones
- [x] Restrict Prisma query logging in production to prevent log flooding and parameter exposure (`backend/src/lib/prisma.ts:L10-14`, commit `b191164`) — fixes audit P0.1
- [x] In-flight request deduplication on frontend client (`frontend/src/lib/api.ts:L8-13`) eliminating mounting waterfalls
- [x] Batch `groupBy` review rating and count aggregation (`backend/src/controllers/property.controller.ts:L100-128`) preventing N+1 queries
- [x] Component and context memoization (`useMemo`, `useCallback`) across Auth, Favorites, and Notification contexts (`frontend/src/context/`)
- [x] Startup safety validation for JWT and session configuration (`backend/src/config/auth.config.ts`, `backend/src/index.ts:L33`)

## Remaining
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

