# Testing Architecture & Quality Assurance Audit — RentGoer

**Audit Date:** October 20, 2026  
**Auditor:** Principal Software Architect & Technical Auditor  
**Scope:** Test harness inventory, coverage analysis, concurrency verification scripts, testing gaps, and migration roadmap to enterprise CI/CD.

---

## 1. Executive Summary: Testing Maturity

| Dimension | Current State | Target State | Maturity Score |
|---|---|---|---|
| **Test Framework** | Ad-hoc TSX scripts (34 in `backend/scratch/`) | Vitest / Jest standardized runner | 3.0 / 10 |
| **CI/CD Automation** | 0% (Manual local execution only) | GitHub Actions on every push/PR | 1.0 / 10 |
| **Backend Coverage** | Extensive domain logic coverage via scripts | Automated Unit & Integration suite | 6.5 / 10 |
| **Frontend Coverage** | 0% (No component or integration tests) | React Testing Library + Playwright E2E | 0.0 / 10 |
| **Concurrency Testing** | High quality (interactive transaction checks) | Automated load & race condition tests | 8.5 / 10 |
| **Database Isolation** | Mutates active database; requires manual cleanup | Isolated ephemeral database (Testcontainers) | 2.5 / 10 |

**Verdict:** While the repository lacks a standard testing framework like Jest or Vitest and has no automated CI/CD pipeline, the author has written **34 bespoke TypeScript test scripts** totaling thousands of lines of rigorous assertion code. These scripts thoroughly exercise complex edge cases, concurrency races, token revocation, and real-time synchronization.

---

## 2. Complete Inventory of Test Scripts (`backend/scratch/`)

The 34 scripts in `backend/scratch/` fall into six functional domains:

### 2.1 Concurrency & Race Condition Verification
1. `test-concurrency-controllers.ts` (11.2 KB):
   - Simulates simultaneous rental request acceptance by owner.
   - Verifies optimistic locking and interactive transaction rollback so only one request can transition to `ACCEPTED`.
   - Confirms all competing `PENDING` requests transition atomically to `REJECTED`.
2. `test-owner-rental-requests.ts` (7.4 KB):
   - Tests owner approval and rejection race conditions under concurrent incoming requests.
3. `test-hardened-provisioning-unit.ts` (20.7 KB):
   - Stress tests admin provisioning under concurrent duplicate invocations.
   - Verifies idempotent upsert behavior without duplicate key errors or role degradation.

### 2.2 Real-Time & Event Stream Synchronization
4. `test-notification-sync-unit.ts` (23.8 KB):
   - Verifies read state synchronization between `Notification` and `Message` models.
   - Asserts that reading a conversation marks messages as read and concurrently updates the user's unread notification counter.
5. `test-notification-realtime.ts` (3.4 KB):
   - Connects an `EventSource` client to `/api/notifications/stream` and verifies event emission when actions occur.
6. `test-chat-integration.ts` (8.5 KB):
   - Multi-client simulation: User A and User B exchange messages over SSE.
   - Verifies live delivery, payload integrity, and timestamp sequencing.
7. `test-chat-unit.ts` (10.9 KB):
   - Validates conversation creation, participant constraints, and authorization barriers.
8. `test-pre-rental-chat-unit.ts` (22.6 KB):
   - Exhaustively tests the pre-rental inquiry workflow.
   - Confirms tenant can inquire before submitting a rental request, but cannot chat with themselves or bypass property linkage.

### 2.3 Authentication & Security Hardening
9. `test-jwt-revocation.ts` (9.3 KB):
   - Tests `tokenVersion` invalidation.
   - Confirms that logging out or changing passwords invalidates existing JWTs on all other devices within 0ms.
10. `test-security-hardening.ts` (4.3 KB):
    - Tests rate limiting (`express-rate-limit`), CORS header enforcement, and rejection of forbidden HTTP methods.
11. `test-admin-login.ts` (1.0 KB):
    - Verifies admin role authentication and cookie issuance.
12. `test-profile-and-password.ts` (5.5 KB):
    - Tests password change constraints (current password matching, minimum entropy) and profile updates.

### 2.4 Domain Feature Verifications
13. `test-properties-optimization.ts` (13.7 KB):
    - Validates database query efficiency on `getProperties`.
    - Asserts that batch `groupBy` replaces N+1 review queries.
14. `test-properties.ts` (5.8 KB):
    - CRUD lifecycle for property records: create, edit, list, and soft-availability toggling.
15. `test-property-images.ts` (5.3 KB):
    - Enforces 10-image maximum cap per property.
    - Tests rejection of non-image MIME types and rollback on failed uploads.
16. `test-rental-requests.ts` (8.0 KB):
    - Full request lifecycle: `PENDING` -> `ACCEPTED` / `REJECTED` / `CANCELLED` / `COMPLETED`.
17. `test-favorites.ts` (4.2 KB):
    - Tests toggle idempotency, uniqueness constraints, and tenant-only access.
18. `test-reviews.ts` (7.6 KB):
    - Verifies the business constraint: tenant can only review if a completed rental request exists.
    - Verifies 1-5 rating validation and prevents owner self-review.
19. `test-reports.ts` (11.0 KB):
    - Tests user, property, and message reporting workflows, status transitions, and admin notes.
20. `test-verification.ts` (4.6 KB):
    - Owner identity and property document verification requests.
21. `test-search.ts` (4.0 KB):
    - Multi-parameter filter queries (price, bedrooms, furnishing, city).
22. `test-admin-dashboard.ts` (3.4 KB):
    - Audits admin aggregation metrics and user management endpoints.

### 2.5 Regression & Comprehensive Suites
23. `test-part-e-full-coverage.ts` (19.8 KB): Comprehensive full-lifecycle test script.
24. `test-issue1-regression.ts` (15.5 KB): Regression verification for previous bugs.
25. `test-all.ts` (1.3 KB): Meta-runner executing sequential test scripts.
26. `smoke-test-production.ts` (10.1 KB): End-to-end smoke verification against live Vercel/Render URLs.
27. `test-health-endpoint.ts` (1.4 KB): Validates `/api/health` and database heartbeat.

### 2.6 Maintenance & Diagnostic Utilities
28. `check-admin-users.ts` (0.4 KB)
29. `setup-bucket.ts` (1.8 KB)
30. `fix-ts.ts` (1.6 KB)
31. `owner_requests.ts` (4.5 KB)
32. `test-chat.ts` (4.7 KB)
33. `test-notifications.ts` (5.8 KB)
34. `test.ts` (3.8 KB)

---

## 3. Package.json Registered Test Commands

In `backend/package.json`:
```json
"scripts": {
  "test:provision": "tsx scratch/test-hardened-provisioning-unit.ts",
  "test:chat": "tsx scratch/test-chat-unit.ts",
  "test:notif-sync": "tsx scratch/test-notification-sync-unit.ts",
  "test:pre-rental": "tsx scratch/test-pre-rental-chat-unit.ts",
  "test:concurrency": "tsx scratch/test-concurrency-controllers.ts",
  "test:properties": "tsx scratch/test-properties-optimization.ts"
}
```

---

## 4. Key Gaps & Testing Deficits

### 4.1 Lack of Standard Test Runner
The current suite uses bespoke `console.log` and process exit codes instead of a test runner (Vitest or Jest). Consequently:
- No standardized test discovery (`*.test.ts` or `*.spec.ts`).
- No coverage reporting (lcov, Istanbul).
- No parallelization or watch mode.

### 4.2 Shared State & Database Mutation
Because tests run directly against the live database specified in `DATABASE_URL`:
- Tests create real records in the database. If a test crashes midway through an assertion, cleanup blocks do not run, leaving dirty data.
- Tests cannot safely run concurrently against the same database instance.

### 4.3 Total Absence of Frontend Testing
- **0 Component Tests:** Key frontend components (`OwnerRequestCard`, `PropertyCard`, `ChatWindow`, `Navbar`) have zero automated tests.
- **0 E2E Browser Tests:** No Playwright or Cypress workflows exist to verify user authentication, browsing, filtering, and chat interactions in real browser environments.

---

## 5. Recommended Testing Modernization Plan

### Phase 1: Migrate Backend Scripts to Vitest
1. Install Vitest and Supertest:
   ```bash
   npm install -D vitest supertest @types/supertest
   ```
2. Refactor `scratch/*.ts` into `tests/unit/` and `tests/integration/`.
3. Wrap assertions in standard `describe()`, `it()`, `expect()` blocks.
4. Use transactions with automatic rollback (`afterEach(async () => prisma.$rollback())`) or Testcontainers PostgreSQL to ensure 100% clean test runs.

### Phase 2: Add Frontend Unit & Component Testing
1. Install Vitest, React Testing Library, and MSW (Mock Service Worker) in `frontend/`.
2. Write unit tests for:
   - `AuthContext`: verifies login state persistence and cookie sync.
   - `PropertyFilter`: verifies query parameter generation.
   - `useNotifications`: verifies SSE reconnection logic and polling fallback.

### Phase 3: Implement Playwright E2E Test Suite
1. Install `@playwright/test`.
2. Create 3 core smoke workflows:
   - **Tenant Journey:** Register -> Search property -> Send pre-rental inquiry -> Submit rental request.
   - **Owner Journey:** Login -> Accept rental request -> Verify other requests are auto-rejected -> Mark completed.
   - **Review Journey:** Tenant leaves review on completed property -> Verify review reflects on property detail page.

### Phase 4: CI/CD Integration via GitHub Actions
Create `.github/workflows/ci.yml`:
- Trigger on `pull_request` and `push` to `main`.
- Jobs:
  1. `lint`: Run ESLint on frontend and backend.
  2. `typecheck`: Run `tsc --noEmit` on both workspaces.
  3. `test:backend`: Run Vitest against a PostgreSQL service container.
  4. `test:frontend`: Run Vitest component tests.
