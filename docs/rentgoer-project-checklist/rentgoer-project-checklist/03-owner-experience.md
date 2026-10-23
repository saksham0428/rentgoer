# 03 — Owner experience

## Confirmed milestones
- [x] Owner dashboard foundation (`frontend/src/app/owner/page.tsx`) with listing statistics and verification state
- [x] Property create and edit form foundation (`frontend/src/components/property/PropertyForm.tsx`, `frontend/src/app/owner/properties/new/`, `frontend/src/app/owner/properties/[id]/edit/`)
- [x] Owner listings endpoint (`GET /api/properties/owner/me`, `backend/src/controllers/property.controller.ts:L166`)
- [x] Owner incoming rental request dashboard (`frontend/src/app/owner/requests/page.tsx`, `frontend/src/components/owner/OwnerRequestCard.tsx`)
- [x] Owner identity verification request submission (`POST /api/verification/owner`, `backend/src/controllers/verification.controller.ts:L6`)
- [x] Property document verification request submission (`POST /api/properties/:id/verification`, `backend/src/controllers/verification.controller.ts:L45`)
- [x] Strict ownership enforcement asserting `property.ownerId === req.user.id` on update and delete (`backend/src/controllers/property.controller.ts:L196, L246`)

## Remaining
- [ ] Verify owner property CRUD in the live application
- [ ] Verify image add/delete and validation through the UI in live environment
- [ ] Audit owner dashboard loading/error/empty states
- [ ] Verify owners cannot edit or delete another owner's property (live boundary check)
- [ ] Note technical debt: `PropertyForm.tsx:L132` bypasses `api.ts` helper and uses raw `fetch` for multipart FormData (`CODE_QUALITY.md:L52-57`)
- [ ] Decompose owner dashboard page component (`frontend/src/app/owner/page.tsx`, 380 lines) into modular subcomponents

