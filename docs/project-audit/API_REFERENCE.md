# API Reference — RentGoer

**Audit Date:** October 20, 2026  
**Auditor:** Senior Technical Documentation Auditor & Repository Verification Engineer  
**Scope:** Exhaustive catalog of all 66 registered API routes across 16 route modules and Express server root.

All endpoints are prefixed with `/api`. From the browser, client requests route through the Next.js rewrite proxy at `/api/proxy/*` **[Verified in source]**.  
Authentication uses an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie named `rentgoer_token` **[Verified in source]**.  
Standard JSON response envelope: `{ success: boolean, data?: any, message?: string }` **[Verified in source]**.

**Total Registered Endpoints:** **66** **[Verified in source]**

---

## 1. Authentication — `/api/auth` (7 Routes)
*Router File:* `backend/src/routes/auth.routes.ts` | *Controller:* `auth.controller.ts`

| Method | Path | Auth | Role | Rate Limit | Description | Confidence |
|---|---|---|---|---|---|---|
| `POST` | `/api/auth/register` | No | Public | 50 / 15m | Register new user (TENANT or OWNER; blocks ADMIN) | **[Verified in source]** |
| `POST` | `/api/auth/login` | No | Public | 50 / 15m | Authenticate user, issue `rentgoer_token` cookie | **[Verified in source]** |
| `POST` | `/api/auth/logout` | No | Public | 50 / 15m | Increment `tokenVersion`, clear cookie | **[Verified in source]** |
| `GET` | `/api/auth/me` | Yes | Any | 1000 / 15m | Get authenticated user; validates `tokenVersion` | **[Verified in source]** |
| `PUT` | `/api/auth/profile` | Yes | Any | 1000 / 15m | Update user name and optional phone | **[Verified in source]** |
| `PUT` | `/api/auth/change-password` | Yes | Any | 15 / 15m | Change password; increments `tokenVersion` | **[Verified in source]** |
| `PUT` | `/api/auth/change-email` | Yes | Any | 15 / 15m | Change email with password check; updates cookie | **[Verified in source]** |

---

## 2. Properties & Sub-Resources — `/api/properties` (15 Routes)
*Router File:* `backend/src/routes/property.routes.ts` | *Controllers:* `property.controller.ts`, `property-image.controller.ts`, `favorite.controller.ts`, `rental-request.controller.ts`, `review.controller.ts`, `report.controller.ts`, `verification.controller.ts`

| Method | Path | Auth | Role | Description | Confidence |
|---|---|---|---|---|---|
| `GET` | `/api/properties` | No | Public | Paginated list with full-text search & faceted filters | **[Verified in source]** |
| `GET` | `/api/properties/:id` | No | Public | Detailed property view with images and owner info | **[Verified in source]** |
| `GET` | `/api/properties/owner/me` | Yes | OWNER | Retrieve listings owned by authenticated owner | **[Verified in source]** |
| `POST` | `/api/properties` | Yes | OWNER | Create new property listing | **[Verified in source]** |
| `PUT` | `/api/properties/:id` | Yes | OWNER | Update listing fields or availability (ownership enforced) | **[Verified in source]** |
| `DELETE` | `/api/properties/:id` | Yes | OWNER | Cascade delete property and associated images/data | **[Verified in source]** |
| `POST` | `/api/properties/:id/images` | Yes | OWNER | Upload up to 5 images (multipart/form-data, max 10 total) | **[Verified in source]** |
| `DELETE` | `/api/properties/:id/images/:imageId` | Yes | OWNER | Delete image from Supabase storage and database | **[Verified in source]** |
| `POST` | `/api/properties/:id/favorite` | Yes | TENANT | Add property to user favorites | **[Verified in source]** |
| `DELETE` | `/api/properties/:id/favorite` | Yes | TENANT | Remove property from user favorites | **[Verified in source]** |
| `POST` | `/api/properties/:id/rental-requests` | Yes | TENANT | Submit rental application with message | **[Verified in source]** |
| `GET` | `/api/properties/:id/reviews` | No | Public | List reviews with average rating aggregation | **[Verified in source]** |
| `POST` | `/api/properties/:id/reviews` | Yes | TENANT | Create review (requires completed rental request) | **[Verified in source]** |
| `POST` | `/api/properties/:id/report` | Yes | Any | Report property (injects `targetType='PROPERTY'`) | **[Verified in source]** |
| `POST` | `/api/properties/:id/verification` | Yes | OWNER | Submit property verification request for admin review | **[Verified in source]** |

---

## 3. Favorites — `/api/favorites` (2 Routes)
*Router File:* `backend/src/routes/favorite.routes.ts` | *Controller:* `favorite.controller.ts`

| Method | Path | Auth | Role | Description | Confidence |
|---|---|---|---|---|---|
| `GET` | `/api/favorites` | Yes | TENANT | Get list of favorited properties with full details | **[Verified in source]** |
| `GET` | `/api/favorites/ids` | Yes | TENANT | Get array of favorited property IDs (`string[]`) | **[Verified in source]** |

---

## 4. Rental Requests — `/api/rental-requests` (6 Routes)
*Router File:* `backend/src/routes/rental-request.routes.ts` | *Controller:* `rental-request.controller.ts`

| Method | Path | Auth | Role | Description | Confidence |
|---|---|---|---|---|---|
| `GET` | `/api/rental-requests/me` | Yes | TENANT | Get all rental requests submitted by current tenant | **[Verified in source]** |
| `DELETE` | `/api/rental-requests/:id` | Yes | TENANT | Cancel a PENDING rental request | **[Verified in source]** |
| `GET` | `/api/rental-requests/owner` | Yes | OWNER | Get incoming requests for owner's properties | **[Verified in source]** |
| `POST` | `/api/rental-requests/:id/accept` | Yes | OWNER | Accept request: locks availability, auto-rejects others | **[Verified in source]** |
| `POST` | `/api/rental-requests/:id/reject` | Yes | OWNER | Reject a single PENDING request | **[Verified in source]** |
| `POST` | `/api/rental-requests/:id/complete` | Yes | OWNER | Mark an ACCEPTED tenancy as COMPLETED | **[Verified in source]** |

---

## 5. Conversations & Chat — `/api/conversations` (10 Routes)
*Router File:* `backend/src/routes/chat.routes.ts` | *Controller:* `chat.controller.ts`

| Method | Path | Auth | Role | Description | Confidence |
|---|---|---|---|---|---|
| `GET` | `/api/conversations` | Yes | Any | List all conversations for the user with last message | **[Verified in source]** |
| `POST` | `/api/conversations` | Yes | Any | Create or find conversation by propertyId | **[Verified in source]** |
| `POST` | `/api/conversations/pre-rental` | Yes | Any | Alias for conversation initiation | **[Verified in source]** |
| `GET` | `/api/conversations/unread-count` | Yes | Any | Total count of unread incoming chat messages | **[Verified in source]** |
| `GET` | `/api/conversations/:id` | Yes | Any | Get conversation header and participant details | **[Verified in source]** |
| `PATCH` | `/api/conversations/:id/read` | Yes | Any | Atomically mark messages & notifications as read | **[Verified in source]** |
| `POST` | `/api/conversations/:id/read` | Yes | Any | Alternative method for marking conversation read | **[Verified in source]** |
| `GET` | `/api/conversations/:id/messages` | Yes | Any | Get messages with pagination (`limit`, `after` cursor) | **[Verified in source]** |
| `POST` | `/api/conversations/:id/messages` | Yes | Any | Send message, broadcast to SSE, emit notification | **[Verified in source]** |
| `GET` | `/api/conversations/:id/realtime` | Yes | Any | SSE stream for real-time conversation messages | **[Verified in source]** |

---

## 6. Notifications — `/api/notifications` (5 Routes)
*Router File:* `backend/src/routes/notification.routes.ts` | *Controller:* `notification.controller.ts`

| Method | Path | Auth | Role | Description | Confidence |
|---|---|---|---|---|---|
| `GET` | `/api/notifications` | Yes | Any | Get paginated notification list | **[Verified in source]** |
| `GET` | `/api/notifications/unread-count` | Yes | Any | Get count of unread notifications | **[Verified in source]** |
| `PUT` | `/api/notifications/read-all` | Yes | Any | Mark all notifications & chat messages as read | **[Verified in source]** |
| `PUT` | `/api/notifications/:id/read` | Yes | Any | Mark single notification as read | **[Verified in source]** |
| `GET` | `/api/notifications/realtime` | Yes | Any | SSE stream delivering live notifications and sync events | **[Verified in source]** |

---

## 7. Reviews Management — `/api/reviews` (2 Routes)
*Router File:* `backend/src/routes/review.routes.ts` | *Controller:* `review.controller.ts`

| Method | Path | Auth | Role | Description | Confidence |
|---|---|---|---|---|---|
| `PUT` | `/api/reviews/:id` | Yes | TENANT | Update rating, title, or comment on existing review | **[Verified in source]** |
| `DELETE` | `/api/reviews/:id` | Yes | TENANT | Delete own review | **[Verified in source]** |

---

## 8. Reports & Moderation Ingestion — `/api/reports`, `/api/users`, `/api/messages` (4 Routes)
*Router Files:* `backend/src/routes/report.routes.ts`, `user.routes.ts`, `message.routes.ts` | *Controller:* `report.controller.ts`

| Method | Path | Auth | Role | Description | Confidence |
|---|---|---|---|---|---|
| `POST` | `/api/reports` | Yes | Any | Submit generic report (body defines `targetType`) | **[Verified in source]** |
| `GET` | `/api/reports/me` | Yes | Any | List reports filed by the authenticated user | **[Verified in source]** |
| `POST` | `/api/users/:id/report` | Yes | Any | Report user (injects `targetType='USER'`) | **[Verified in source]** |
| `POST` | `/api/messages/:id/report` | Yes | Any | Report chat message (injects `targetType='MESSAGE'`) | **[Verified in source]** |

---

## 9. Verification Submissions — `/api/verification` (2 Routes)
*Router File:* `backend/src/routes/verification.routes.ts` | *Controller:* `verification.controller.ts`

| Method | Path | Auth | Role | Description | Confidence |
|---|---|---|---|---|---|
| `POST` | `/api/verification/owner` | Yes | OWNER | Submit owner identity verification request | **[Verified in source]** |
| `GET` | `/api/verification/me` | Yes | Any | Get user's own verification request history | **[Verified in source]** |

---

## 10. Admin Operations — `/api/admin/*` (12 Routes)
*Router Files:* `admin-stats.routes.ts`, `admin-user.routes.ts`, `admin-property.routes.ts`, `admin-report.routes.ts`, `admin-verification.routes.ts`  
*Authorization:* All routes protected by `authMiddleware` + `requireRole('ADMIN')` **[Verified in source]**.

| Method | Path | Description | Confidence |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Aggregated counts: users, properties, reports, verifications | **[Verified in source]** |
| `GET` | `/api/admin/users` | List users with filters (`role`, `isVerified`, `search`, `page`) | **[Verified in source]** |
| `GET` | `/api/admin/users/:id` | Detailed user view with listings and rental request metrics | **[Verified in source]** |
| `GET` | `/api/admin/properties` | List properties with admin visibility | **[Verified in source]** |
| `GET` | `/api/admin/properties/:id` | Detailed admin property view | **[Verified in source]** |
| `GET` | `/api/admin/reports` | List reports with filters (`status`, `targetType`, `reason`) | **[Verified in source]** |
| `GET` | `/api/admin/reports/:id` | Detailed report view with reporter details | **[Verified in source]** |
| `PUT` | `/api/admin/reports/:id/status` | Update report status (`OPEN`/`REVIEWING`/`RESOLVED`/`DISMISSED`) + notes | **[Verified in source]** |
| `GET` | `/api/admin/verification` | List verification requests with filters (`type`, `status`) | **[Verified in source]** |
| `GET` | `/api/admin/verification/:id` | View verification request details | **[Verified in source]** |
| `PUT` | `/api/admin/verification/:id/approve` | Approve verification; sets `isVerified = true` on User or Property | **[Verified in source]** |
| `PUT` | `/api/admin/verification/:id/reject` | Reject verification with recorded `rejectionReason` | **[Verified in source]** |

---

## 11. Health Verification — `/api/health` (1 Route)
*Registered In:* `backend/src/index.ts`

| Method | Path | Auth | Description | Confidence |
|---|---|---|---|---|
| `GET` | `/api/health` | No | Database heartbeat (`SELECT 1`). Returns HTTP 200 or 503 | **[Verified in source]** |
