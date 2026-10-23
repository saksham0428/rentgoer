# 01 — Authentication & sessions

## Confirmed milestones
- [x] Add per-device Session model and legacy-token revocation model (`backend/prisma/schema.prisma:L312-337`, migration `20261021000000_add_sessions_and_legacy_revocation`)
- [x] Implement session-aware token validation, expiry, and revocation checks (`backend/src/middleware/auth.middleware.ts:L40-150`)
- [x] Add logout behavior that revokes only the current session or legacy token without account-wide lockout (`backend/src/controllers/auth.controller.ts:L142-184`)
- [x] Add cleanup script for expired session and revocation records (`backend/src/scripts/cleanup-sessions.ts`, npm script `auth:cleanup`)
- [x] Implement password change with atomic global session revocation and tokenVersion increment (`backend/src/controllers/auth.controller.ts:L204-246`)
- [x] Implement email change with password check, email uniqueness check, and atomic session revocation (`backend/src/controllers/auth.controller.ts:L248-316`)
- [x] Implement startup configuration validation for JWT_SECRET, LEGACY_TOKEN_CUTOFF_DATE, and ENABLE_SESSION_ISSUANCE (`backend/src/config/auth.config.ts`, `backend/src/index.ts:L33`)
- [x] Implement dedicated rate limits: 50 req/15min for auth, 15 req/15min for password/email changes (`backend/src/routes/auth.routes.ts:L16-32`)
- [x] Run Prisma validation, backend build, 30 unit tests, and 8 isolated PostgreSQL integration scenarios for session work (`npm run test:session:unit` passes 30/30)
- [x] Deploy Stage A with `ENABLE_SESSION_ISSUANCE=false` (verified in live production environment)
- [x] Smoke-check legacy logout revocation and session-aware token rejection behavior (empirically confirmed)

## Remaining
- [ ] Continue monitoring Stage A stability and production authentication behavior
- [ ] Review accumulated expired records periodically while no scheduled cleanup is configured
- [ ] Decide when to activate Stage B session issuance
- [ ] At Stage B activation, set `ENABLE_SESSION_ISSUANCE=true` and establish the legacy cutoff as exactly seven days after activation
- [ ] Test two-device behavior in live Stage B: logging out device A invalidates A while device B remains valid
- [ ] Verify live password/email changes invalidate all prior active sessions across multiple devices
- [ ] Confirm legacy-token cutoff handling and re-login behavior after cutoff in live environment

## Guardrails
- Stage A remains the current posture; do not switch issuance on without explicit approval.
- Cleanup is not a substitute for request-time token/session expiry and revocation enforcement.
- No Cron Job is configured; this was intentionally skipped to avoid extra cost.

