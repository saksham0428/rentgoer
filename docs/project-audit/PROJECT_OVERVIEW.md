# Project Overview — RentGoer

## Product Goals

RentGoer solves a specific pain point in the Indian rental market: traditional property rentals require brokers who charge one to two months of rent as commission (brokerage). RentGoer eliminates this by providing a direct marketplace where owners post listings and tenants contact owners without a human intermediary.

## Core Value Propositions

1. **Zero Brokerage** - No commission fee for either party.
2. **Direct Communication** - Built-in chat between owners and tenants.
3. **Verified Listings** - An admin-driven verification layer for owners and properties.
4. **Transparent Lifecycle** - Rental requests, acceptance, completion, and reviews are tracked end-to-end.

## User Roles

| Role | Description | Registration |
|---|---|---|
| TENANT | Browses properties, saves favorites, submits rental requests, chats, reviews | Self-register |
| OWNER | Lists properties, manages requests, chats with tenants, requests verification | Self-register |
| ADMIN | Manages users, verifies owners/properties, reviews reports | Provisioned via script |

ADMIN accounts cannot be created via the public registration endpoint (enforced at line 46-49 of auth.controller.ts). They are provisioned using the backend script 
pm run admin:provision.

## Tenant User Journey

1. Visit the landing page (/) — sees hero section with CTA to browse properties.
2. Navigate to /properties — browse paginated property listings with search and filters.
3. Click a property card — view detail page (/properties/[id]) with images, description, reviews, and owner contact info.
4. Register as a tenant or log in.
5. Save a property to favorites (heart icon) — stored in FavoritesContext and database.
6. Start a pre-rental conversation — tenant can chat with an owner before committing to a request.
7. Submit a rental request — form with a message (10-1000 chars), sent to /properties/:id/rental-requests.
8. Track request status at /rental-requests — PENDING, ACCEPTED, REJECTED, CANCELLED, COMPLETED.
9. If accepted, a conversation is automatically created/linked and the tenant can chat with the owner.
10. After rental completes (owner marks COMPLETED), tenant can leave a review for the property.
11. Tenant can report properties, users, or messages via the report form.

## Owner User Journey

1. Register as an owner or log in.
2. Access the Owner Dashboard (/owner) — sees verification status, property count stats.
3. Add a property (/owner/properties/new) — multi-field form including title, description, rent, location, type, furnishing, images.
4. Upload property images (up to 10 total, 5 per request batch, 5MB each, JPEG/PNG/WebP).
5. Manage property availability and edit listings (/owner/properties/:id/edit).
6. View and manage incoming rental requests (/owner/requests).
7. Accept or reject requests. Acceptance atomically marks the property unavailable and rejects all other pending requests.
8. Mark a request as COMPLETE (enables tenant to leave a review).
9. Request owner verification and property verification from the dashboard.
10. Chat with tenants via conversations (pre-rental or post-acceptance).
11. View all chat conversations at /chat.

## Admin User Journey (Verified from code)

1. Log in as admin (provisioned account — no public registration).
2. Access the Admin Center (/admin) — see dashboard stats: user counts, property counts, open reports, pending verifications.
3. Manage users (/admin/users) — list, search, filter by role/verification; view user detail.
4. Manage properties (/admin/properties) — list and view admin property records.
5. Review verification requests (/admin/verification) — approve or reject owner/property verifications.
6. Review user and property reports (/admin/reports) — update status (OPEN, REVIEWING, RESOLVED, DISMISSED) and add moderator notes.

## Feature Inventory Summary

| Feature | Status | Notes |
|---|---|---|
| Landing page | Implemented | Server component, role-aware CTA |
| Property listing/search | Implemented | Full filter, sort, pagination |
| Property detail page | Implemented | Gallery, owner info, reviews |
| Property CRUD (owner) | Implemented | Full validation, ownership check |
| Property images | Implemented | Supabase Storage, 10-img cap, rollback |
| User registration | Implemented | Tenant and Owner roles only |
| Login / logout | Implemented | HttpOnly cookie, bcrypt |
| Session persistence | Implemented | tokenVersion revocation |
| Profile update | Implemented | Name + phone only |
| Password change | Implemented | Revokes all other sessions |
| Email change | Implemented | Password verification required |
| Favorites | Implemented | TENANT only, optimistic UI |
| Rental requests | Implemented | Full lifecycle PENDING/ACCEPTED/REJECTED/CANCELLED/COMPLETED |
| Owner rental request management | Implemented | Accept (atomic, with retry), reject, complete |
| Pre-rental conversations | Implemented | Tenant initiates before formal request |
| Chat messaging | Implemented | Persistent, SSE real-time |
| SSE chat stream | Implemented | With 5s polling fallback |
| Message read status | Implemented | readAt timestamp, atomic sync |
| Notifications | Implemented | RENTAL_REQUEST, REQUEST_ACCEPTED, REQUEST_REJECTED, CHAT_MESSAGE |
| Notification SSE stream | Implemented | Per-user channel |
| Unread count (header) | Implemented | Notification + chat badge in Navbar |
| Read synchronization | Implemented | Atomic transaction + SSE emit |
| Reviews | Implemented | COMPLETED requests only, 1 per request |
| Review update/delete | Implemented | Tenant only |
| Reports | Implemented | PROPERTY/USER/MESSAGE target types |
| Admin dashboard | Implemented | Stats, users, properties, reports |
| Admin verification | Implemented | Approve/reject owner and property |
| Admin reports | Implemented | Status transitions, moderator notes |
| Owner verification | Implemented | Submit request, admin action |
| Property verification | Implemented | Submit request, admin action |
| Email notifications | Missing | No email service integrated |
| Search by text/keyword | Missing | Only city/locality substring search |
| Saved search / alerts | Missing | Not implemented |
| Map view | Missing | lat/lon stored but no map component |
| Payment integration | Missing | Not scoped |
| Social auth | Missing | Not scoped |
