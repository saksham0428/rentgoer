# 06 — Reviews, verification, reports & admin

## Confirmed milestones
- [x] Review schema model with unique constraint `[rentalRequestId]` preventing multiple reviews (`backend/prisma/schema.prisma:L218-242`)
- [x] Review creation endpoint (`POST /api/properties/:id/reviews`) enforcing completed tenancy check and blocking owner self-reviews (`backend/src/controllers/review.controller.ts:L5-88`)
- [x] Review edit and delete endpoints with tenant ownership checks (`PUT /api/reviews/:id`, `DELETE /api/reviews/:id`, `backend/src/controllers/review.controller.ts:L90-178`)
- [x] Batch review aggregation (`_avg: { rating }`, `_count: { id }`) in property queries (`backend/src/controllers/property.controller.ts:L100-128`)
- [x] Polymorphic reporting schema (targets: `PROPERTY`, `USER`, `MESSAGE`; 9 reasons) (`backend/prisma/schema.prisma:L244-270`)
- [x] Reporting ingestion endpoints: `/api/reports`, `/properties/:id/report`, `/users/:id/report`, `/messages/:id/report` (`backend/src/controllers/report.controller.ts`)
- [x] Admin report moderation queue with status transitions (`OPEN`, `REVIEWING`, `RESOLVED`, `DISMISSED`) and moderator notes (`backend/src/controllers/admin-report.controller.ts`)
- [x] Identity and property verification submission endpoints (`POST /api/verification/owner`, `POST /api/properties/:id/verification`) (`backend/src/controllers/verification.controller.ts`)
- [x] Admin verification review endpoints (`GET /api/admin/verification`, `PUT /api/admin/verification/:id/approve`, `reject`) setting `isVerified=true` (`backend/src/controllers/admin-verification.controller.ts`)
- [x] Admin stats aggregation endpoint (`GET /api/admin/stats`, `backend/src/controllers/admin-stats.controller.ts`)
- [x] Admin user management and property oversight endpoints (`GET /api/admin/users`, `/api/admin/properties`)
- [x] Strict RBAC enforcement via `requireRole('ADMIN')` on all 12 admin endpoints (`backend/src/middleware/role.middleware.ts`)
- [x] Hardened admin provisioning CLI script (`backend/src/scripts/provision-admin.ts`, npm script `admin:provision`) with bcrypt salt factor 12 and idempotent upsert
- [x] Frontend admin portal (`/admin`, `/admin/users`, `/admin/properties`, `/admin/reports`, `/admin/verification`)
- [x] Frontend review display & submission components (`frontend/src/components/property/PropertyReviews.tsx`)
- [x] Frontend reporting modal and trigger buttons (`frontend/src/components/report/ReportModal.tsx`)
- [x] Dedicated test scripts (`backend/scratch/test-reviews.ts`, `backend/scratch/test-reports.ts`, `backend/scratch/test-verification.ts`, `backend/scratch/test-admin-dashboard.ts`, `backend/scratch/test-hardened-provisioning-unit.ts`)

## Remaining
- [ ] Verify review rules, rating validation, and owner self-review prevention in live application
- [ ] Verify owner/property verification request workflows in live application
- [ ] Verify reporting of users, properties, and messages in live application
- [ ] Verify report status transitions and admin notes in live admin portal
- [ ] Verify admin dashboard aggregation and user-management authorization in live environment
- [ ] Verify hardened admin provisioning and idempotency against staging/production database

