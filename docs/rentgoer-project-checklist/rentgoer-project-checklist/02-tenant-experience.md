# 02 — Tenant experience

## Confirmed milestones
- [x] Property browsing and detail foundation (`frontend/src/app/properties/page.tsx`, `frontend/src/app/properties/[id]/page.tsx`, `frontend/src/components/ui/PropertyCard.tsx`, `frontend/src/components/property/ImageGallery.tsx`)
- [x] Search and dynamic property filters for price, bedrooms, bathrooms, furnishing, property type, and verification (`frontend/src/components/property/PropertyFilters.tsx`, `backend/src/controllers/property.controller.ts:L24-78`)
- [x] Pagination and sorting (newest, rent_asc, rent_desc, verified) (`frontend/src/components/property/Pagination.tsx`, `backend/src/controllers/property.controller.ts:L80-97`)
- [x] Save/unsave favorite properties with optimistic UI and compound unique constraint (`frontend/src/context/FavoritesContext.tsx`, `backend/src/controllers/favorite.controller.ts:L6-48`)
- [x] Dedicated tenant dashboard (`/tenant`) with active rental requests, favorites summary, and role redirection (`frontend/src/app/tenant/page.tsx`)
- [x] Dedicated tenant favorites page (`/favorites`) with listing grid (`frontend/src/app/favorites/page.tsx`)

## Remaining
- [ ] Audit and polish empty states, loading states, and API error feedback
- [ ] End-to-end verify search → property detail → favorite → favorites page
- [ ] Review mobile layout and accessibility for tenant flows
- [ ] Note audit gap: text search is city/locality substring matching; description text search is not indexed (`PROJECT_OVERVIEW.md:L97`)
- [ ] Note audit gap: map-based view is missing (coordinates exist in schema, but no map component is integrated; `PROJECT_OVERVIEW.md:L99`)
- [ ] Note audit gap: saved searches and email alerts are not implemented (`PROJECT_OVERVIEW.md:L98`)

