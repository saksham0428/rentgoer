# 07 — Testing & CI/CD

## Confirmed milestones
- [x] Inventory the bespoke test scripts across backend and frontend (37 scripts in `backend/scratch/`, 1 script in `frontend/scratch/`)
- [x] Verify backend build (`npm run build` / `tsc` passes with exit code 0)
- [x] Verify backend targeted session unit tests (`npm run test:session:unit` passes all 30 offline tests)
- [x] Verify frontend TypeScript compilation (`npx tsc --noEmit` passes with exit code 0 and zero errors)
- [x] Establish a standard backend test runner (Vitest configured for offline unit tests and sequential PostgreSQL integration tests)
- [x] Separate unit and integration tests from scratch/diagnostic scripts into `backend/tests/` (`backend/tests/unit/` 12 files / 196 tests, `backend/tests/integration/` 3 files / 17 tests)
- [x] Ensure integration tests use an isolated test database and never production `DATABASE_URL` (`backend/.env.test.local` isolated config and `test-db-guard.ts` fail-closed verification)
- [x] Add test cleanup/rollback guarantees and explicit environment guards (`ScopedTestContext` non-destructive entity tracking and fail-closed loopback guards)

## Remaining
- [ ] Add frontend component tests for authentication, filters, favorites, and realtime hooks (0 currently exist)
- [ ] Add Playwright end-to-end smoke workflows for tenant and owner journeys (0 currently exist)
- [ ] Add GitHub Actions CI for lint, typecheck, and safe automated tests (`.github/workflows` not yet created)
- [ ] Add coverage reporting and establish a baseline
- [ ] Review the 37 scratch scripts: migrate useful tests, label diagnostics, and remove only after confirming unused
- [ ] Resolve frontend ESLint failures (`npm run lint` failed with 6 errors, 19 warnings: 5 in `frontend/scratch/test-header-counts.ts`, 1 in `useConversationRealtime.ts:L17`)
- [ ] Add ESLint configuration and `npm run lint` script to backend (`backend/package.json` currently has no linter configured)

## Audit notes
The supplied `TESTING.md` audit reported 34 bespoke TypeScript scripts in `backend/scratch/`, no standard Vitest/Jest runner, no CI/CD automation, no frontend component tests, and tests that could mutate a configured database. The current repository contains 37 scripts in `backend/scratch/` and 1 in `frontend/scratch/`. Both frontend and backend TypeScript compilation passes cleanly. Automated CI/CD and standardized runners remain the primary testing gaps.

