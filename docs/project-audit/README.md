# RentGoer — Complete Technical Audit

**Audit Date:** October 20, 2026  
**Auditor:** Senior Technical Documentation Auditor & Repository Verification Engineer  
**Repository:** `saksham0428/rentgoer`  
**Production Frontend:** https://rentgoer.vercel.app *(Unverified - live DNS/TLS and uptime not probed)*  
**Production Backend:** https://rentgoer.onrender.com *(Unverified - live server not queried with intrusive probes)*  

---

## Confidence Level Classifications

In compliance with strict technical auditing standards, all claims in this audit package are categorized as follows:
- **[Verified in source]**: Directly confirmed by inspection of current source code, configuration files, or Prisma migrations.
- **[Test verified]**: Confirmed by an automated or scratch verification script executed and verified in the repository.
- **[Production verified]**: Confirmed against the live multi-cloud production environment with direct runtime evidence.
- **[Inferred]**: A sound technical conclusion derived from code architecture, but not directly asserted by a single source line.
- **[Unverified]**: Requires access to live production cloud consoles (Vercel dashboard, Render dashboard, Supabase dashboard) or credentials that are unavailable offline.

---

## What Is RentGoer?

RentGoer is a **direct rental marketplace** connecting property owners and tenants without brokers **[Verified in source]**.
Core proposition: zero-commission, direct connections between landlords and renters in India.

The platform supports two user roles (Tenant and Owner), a full rental lifecycle, real-time messaging, SSE notifications, a reports/moderation system, and an admin portal **[Verified in source]**.

---

## Maturity Assessment: Late Development / Early Beta

**Evidence:**
- Full CRUD for properties, rental requests, conversations, notifications, reviews, and reports is implemented **[Verified in source]**.
- Authentication is robust: bcrypt (cost factor 12) + JWT + HttpOnly cookies + `tokenVersion` session revocation **[Verified in source]**.
- Real-time Server-Sent Events (SSE) channels for notifications and chat are implemented via Node.js EventEmitters **[Verified in source]**.
- Admin portal exists with user/property/report/verification management **[Verified in source]**.
- No automated integration test runner (Vitest/Jest) or CI/CD pipeline. 34 manual TypeScript verification scripts exist in `backend/scratch/` **[Verified in source]**.
- No production monitoring (Sentry, Datadog), structured logging, or email notification service configured **[Verified in source]**.
- Production URLs are configured in manifests, but live dashboard settings remain unverified **[Unverified]**.

---

## Navigation

| Document | Contents |
|---|---|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Product goals, roles, user journeys, feature inventory |
| [TECH_STACK.md](TECH_STACK.md) | All dependencies, versions, and usage analysis |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, Mermaid diagrams, data flows |
| [FEATURES.md](FEATURES.md) | Detailed feature behavior, state machines, and implementation status |
| [DATABASE.md](DATABASE.md) | Tables, fields, relationships, ER diagram, index audit |
| [API_REFERENCE.md](API_REFERENCE.md) | Complete endpoint catalog (66 routes verified against route files) |
| [AUTH_SECURITY.md](AUTH_SECURITY.md) | Authentication trace, security audit, severity findings |
| [STATE_AND_RENDERING.md](STATE_AND_RENDERING.md) | Providers, hooks, rendering lifecycle, header count badges |
| [REALTIME.md](REALTIME.md) | SSE architecture, messaging, notifications, polling fallbacks |
| [PERFORMANCE.md](PERFORMANCE.md) | Bottlenecks, N+1 queries, caching recommendations |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Hosting, environment vars, deployment checklist |
| [TESTING.md](TESTING.md) | Test inventory (34 scripts), coverage gaps, quality assessment |
| [CODE_QUALITY.md](CODE_QUALITY.md) | Maintainability, dead code, inconsistencies |
| [ROADMAP.md](ROADMAP.md) | Prioritized P0-P4 recommendations |
| [AUDIT_LIMITATIONS.md](AUDIT_LIMITATIONS.md) | What could not be verified and why |

---

## Verified Repository Metrics

| Metric | Verified Value | Evidence Source |
|---|---|---|
| API route endpoints | **66** | `backend/src/routes/*.ts` + `backend/src/index.ts` **[Verified in source]** |
| Database models | **11** | `backend/prisma/schema.prisma` **[Verified in source]** |
| Database enums | **10** | `backend/prisma/schema.prisma` **[Verified in source]** |
| Prisma migrations | **13** | `backend/prisma/migrations/` **[Verified in source]** |
| Backend controllers | **14** | `backend/src/controllers/*.ts` **[Verified in source]** |
| Scratch verification scripts | **34** | `backend/scratch/*.ts` **[Verified in source]** |
| Frontend runtime deps | **5** | `frontend/package.json` (`dependencies`) **[Verified in source]** |
| Backend runtime deps | **13** (excl. types/tooling) | `backend/package.json` (`dependencies`) **[Verified in source]** |

---

## Top Security Findings

1. **Medium** — `tokenVersion` DB lookup on every auth check: guarantees immediate session revocation upon logout or password change, but adds one database roundtrip per authenticated request **[Verified in source]**.
2. **Medium** — SSE connections stored in-process via EventEmitters: prevents horizontal scaling across multiple container instances without Redis Pub/Sub **[Verified in source]**.
3. **Low** — `prisma.ts` unconditionally logs queries (`log: ['query', 'error', 'warn']`), printing all queries and params to stdout in production **[Verified in source]**.
4. **Low** — SameSite=Lax cookie with proxy rewrite mitigates standard CSRF, but no explicit CSRF tokens are enforced on mutating routes **[Verified in source]**.
5. **Unverified** — Supabase Storage bucket policy and RLS cannot be audited from local git files **[Unverified]**.

---

## Top Performance Findings

1. Every authenticated request executes `prisma.user.findUnique` to validate `tokenVersion` **[Verified in source]**.
2. `getProperties` performs a secondary `groupBy` query across `Review` to compute aggregated ratings and counts (efficient batching, avoids N+1, but executes 2 queries per page) **[Verified in source]**.
3. Prisma query logging is active in all environments, producing high I/O overhead on Render **[Verified in source]**.
4. Images are loaded directly from Supabase public storage URLs without an intermediate CDN cache layer **[Verified in source]**.
5. In `useConversationRealtime`, when a chat SSE socket disconnects, a 5-second polling fallback engages until reconnection **[Verified in source]**.

---

## Strongest Implementation Areas

- **Auth & Session Revocation:** bcrypt salt factor 12, signed JWT, `tokenVersion` invalidation across all devices on logout and password change **[Verified in source]**.
- **Rental Request Concurrency:** Interactive transactions (`prisma.$transaction`) with parent row locking (`isAvailable: true`), auto-rejection of competing requests, and deadlock retry loop **[Verified in source]**.
- **Cross-Domain Architecture:** Next.js proxy rewrite `/api/proxy/:path*` transparently bridges Vercel and Render while keeping cookies same-site **[Verified in source]**.
- **Header Synchronization:** Dual badge counters (`unreadChatCount`, `unreadCount`, and `favoriteCount`) synchronized via SSE events (`NOTIFICATION_READ_SYNC`) and custom DOM events **[Verified in source]**.
- **Request Deduplication:** Frontend `api.ts` deduplicates concurrent in-flight GET requests to the same URL **[Verified in source]**.

---

## Highest-Priority Additions (P0 / P1)

1. **P0:** Restrict Prisma query logging in `backend/src/lib/prisma.ts` to `NODE_ENV === 'development'`.
2. **P0:** Add boot-time validation in `backend/src/index.ts` to assert required environment variables exist.
3. **P0:** Remove the empty typographical directory `frontend/src/app/chat/[id`.
4. **P1:** Establish a GitHub Actions CI pipeline for automated linting, type-checking, and test execution.
5. **P1:** Integrate Sentry error tracking on both frontend and backend.
6. **P1:** Migrate active scratch scripts into a standardized Vitest integration test suite.
