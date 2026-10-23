# 00 — Project foundation & core marketplace

## Confirmed milestones
- [x] Next.js frontend foundation and reusable UI components (`frontend/src/app/layout.tsx`, `frontend/src/components/ui/`)
- [x] Express + TypeScript backend foundation (`backend/src/index.ts`, `backend/src/routes/`)
- [x] Prisma schema and Supabase PostgreSQL setup (13 models, 10 enums, 14 migrations in `backend/prisma/`)
- [x] User registration, login, logout, and current-user session endpoint (`backend/src/controllers/auth.controller.ts`)
- [x] User profile update endpoint (`PUT /api/auth/profile`) for name and contact info (`backend/src/controllers/auth.controller.ts:L186`)
- [x] Property CRUD endpoints with owner authorization (`backend/src/controllers/property.controller.ts`)
- [x] Public property discovery with search, filters, sorting, and pagination (`frontend/src/app/properties/page.tsx`, `backend/src/controllers/property.controller.ts`)
- [x] Property image upload integration with Supabase Storage, 10-image cap, and rollback on error (`backend/src/controllers/property-image.controller.ts`)
- [x] Tenant authentication UI and session context (`frontend/src/context/AuthContext.tsx`, `frontend/src/app/login/`, `frontend/src/app/register/`)
- [x] Tenant favorites backend and frontend with optimistic updates (`frontend/src/context/FavoritesContext.tsx`, `backend/src/controllers/favorite.controller.ts`)
- [x] Client request deduplication for concurrent in-flight GET requests (`frontend/src/lib/api.ts:L8-13`)

## Remaining
- [ ] Verify the complete tenant-to-owner journey against the currently deployed build (requires multi-user browser testing)
  - **Status: Blocked / Incomplete (Multi-user browser testing pending manual execution)**
  - **API Verification Completed:** Backend health (`/api/health`), frontend availability (`https://rentgoer.vercel.app`), owner & tenant logins (`/api/auth/login`), owner property management (`/api/properties/owner/me`), public search/filtering (`/api/properties`), tenant favorites lifecycle (`/api/properties/:id/favorite`), and cross-role authorization guards (403 RBAC) passed.
  - **Outstanding Steps:** Multi-user browser automation could not initialize in the agent environment due to Playwright driver CDN unavailability (HTTP 404 on `playwright-1.57.0-win32_x64.zip`). Manual execution of the owner & tenant interactive browser steps (submitting rental request form in tenant UI and accepting/rejecting in owner dashboard) is required with screenshots/results before marking complete.


