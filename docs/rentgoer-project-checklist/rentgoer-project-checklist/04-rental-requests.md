# 04 — Rental requests & lifecycle

## Confirmed milestones
- [x] Rental request schema model and status enum (`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `COMPLETED`) (`backend/prisma/schema.prisma:L102-120`)
- [x] Tenant request submission endpoint (`POST /api/properties/:id/rental-requests`) with message validation (10-1000 chars) and availability guards (`backend/src/controllers/rental-request.controller.ts:L5-85`)
- [x] Tenant active requests list (`GET /api/rental-requests/me`, `backend/src/controllers/rental-request.controller.ts:L87-124`)
- [x] Tenant cancellation endpoint (`DELETE /api/rental-requests/:id`, `backend/src/controllers/rental-request.controller.ts:L126-170`)
- [x] Owner incoming request list (`GET /api/rental-requests/owner`, `backend/src/controllers/rental-request.controller.ts:L172-224`)
- [x] Atomic request acceptance (`POST /api/rental-requests/:id/accept`) with `prisma.$transaction`, property locking (`isAvailable: false`), auto-rejection of competing requests, conversation linkage, and deadlock retry loop (`backend/src/controllers/rental-request.controller.ts:L226-368`)
- [x] Owner single request rejection (`POST /api/rental-requests/:id/reject`, `backend/src/controllers/rental-request.controller.ts:L370-424`)
- [x] Owner tenancy completion (`POST /api/rental-requests/:id/complete`) enabling tenant review unlock (`backend/src/controllers/rental-request.controller.ts:L426-476`)
- [x] Frontend tenant request tracking page and request card (`frontend/src/app/rental-requests/page.tsx`, `frontend/src/components/property/RentalRequestCard.tsx`)
- [x] Frontend tenant rental application modal (`frontend/src/components/property/RentalRequestForm.tsx`)
- [x] Frontend owner request management dashboard (`frontend/src/app/owner/requests/page.tsx`, `frontend/src/components/owner/OwnerRequestCard.tsx`)
- [x] Dedicated concurrency and lifecycle test scripts (`backend/scratch/test-concurrency-controllers.ts`, `backend/scratch/test-rental-requests.ts`)

## Remaining
- [ ] Verify full rental-request lifecycle in the live deployed application (pending -> accepted -> completed -> review)
- [ ] Verify simultaneous acceptance and race-condition handling under live load (exercised by `test-concurrency-controllers.ts`)
- [ ] Verify all competing pending requests transition correctly when one request is accepted in live browser sessions
- [ ] Verify tenant cancellation and owner authorization rules in live browser
- [ ] Verify completed-rental constraints before review submission in live browser
- [ ] Note audit caveat: individual request rejection (`POST /api/rental-requests/:id/reject`) does not dispatch an in-app notification to the tenant (`FEATURES.md:L178`)

