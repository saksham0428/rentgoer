# System Architecture — RentGoer

## High-Level Architecture

```
Browser (React/Next.js Client Components)
    |
    |  HTTP requests to /api/proxy/*
    v
Next.js Server (Vercel)
    |   Next.js rewrites /api/proxy/:path* -> Backend /api/:path*
    |   Cookies forwarded transparently (same-site)
    v
Express Backend (Render — Singapore region intended)
    |-- auth.middleware.ts    <- JWT verify + tokenVersion DB check
    |-- role.middleware.ts    <- Role enforcement (TENANT / OWNER / ADMIN)
    |-- rate-limit middleware <- General 1000/15min, Auth 50/15min
    |-- Controllers (14)
    |
    |-- Prisma ORM -> Supabase PostgreSQL
    |-- Supabase Storage Client -> Supabase Storage (property images)
    |-- Node.js EventEmitter (in-process)
            |-- chatEventEmitter (message:conversationId events)
            |-- notificationEventEmitter (notification:userId events)
```

## Request Types

### 1. Client-Side Browser Request (CSR)
- Origin: React client component
- Target: /api/proxy/* (same Vercel domain)
- Next.js rewrite forwards to backend with the HttpOnly cookie attached

### 2. Server-Side Next.js Request (SSR)
- Origin: Next.js server component during SSR
- Target: Backend URL directly (NEXT_PUBLIC_BACKEND_URL/api/*)
- api.ts detects isServer=true, reads `rentgoer_token` cookie from next/headers and injects it as a Cookie header
- Used in root layout, landing page, property detail pages

### 3. Next.js API Proxy Rewrite
- Defined in next.config.ts: source=/api/proxy/:path*, destination=BACKEND_URL/api/:path*
- Executes at Edge/Node runtime on Vercel
- Transparent to browser — browser only ever talks to *.vercel.app
- This is the mechanism that solves the SameSite cross-domain cookie problem

### 4. SSE Connection (Server-Sent Events)
- Client opens a persistent GET connection to /api/proxy/notifications/realtime or /api/proxy/conversations/:id/realtime
- Next.js proxy rewrites and forwards to backend
- Backend holds the res object open, writes data frames
- Keepalive pings sent every 20 seconds to prevent proxy/Render idle disconnect
- On client disconnect, req.on('close') fires, listener removed, SSE cleaned up

### 5. Polling Fallback
- If SSE connection fails (onerror), useConversationRealtime falls back to polling every 5 seconds

---

## Component Hierarchy (Global State)

```
RootLayout (Server Component)
  AuthProvider (client, wraps everything)
    NotificationProvider (client, reads user from AuthContext)
      FavoritesProvider (client, reads user from AuthContext)
        Navbar (client, reads all three contexts)
        main
          {page content}
        Footer
```

All three providers mount once at the root layout and survive client-side navigation.

---

## Data Flows

### Flow 1: Visitor Browses Properties
1. Next.js renders properties/page.tsx as server component
2. Server component calls api.get('/properties') server-side
3. Backend getProperties() queries Property with images and owner, then groupBy for review aggregates
4. Page receives paginated list, renders PropertyCard components
5. Client-side filter changes trigger new GET /api/proxy/properties requests

### Flow 2: Tenant Logs In
1. POST /api/proxy/auth/login -> backend login()
2. Backend: normalize email, find user, bcrypt.compare password
3. On success: jwt.sign({id, role, tokenVersion}, expiresIn:7d), set HttpOnly cookie
4. AuthContext.refreshUser() sets user state
5. NotificationProvider detects user.id, fires 3 parallel requests + opens SSE stream

### Flow 3: Owner Publishes Property with Images
1. POST /api/proxy/properties -> createProperty() validates input, creates DB record
2. POST /api/proxy/properties/:id/images (multipart) -> uploadImages()
3. multer memoryStorage, 5MB limit, JPEG/PNG/WebP, max 5 per batch, cap 10 total
4. Uploads each file to Supabase Storage at properties/{propertyId}/{uuid}.{ext}
5. Gets public URL, saves PropertyImage record in DB

### Flow 4: Tenant Saves a Property
1. FavoritesContext.toggleFavorite(propertyId) optimistic update
2. POST /api/proxy/properties/:id/favorite -> addFavorite()
3. Backend: create Favorite record, idempotent (catches unique constraint P2002)

### Flow 5: Tenant Submits Rental Request
1. POST /api/proxy/properties/:id/rental-requests
2. Backend: checks property available, no existing active request, creates RentalRequest (PENDING)
3. Creates Notification for owner, emitNotification fires SSE event to owner

### Flow 6: Owner Accepts Request
1. POST /api/proxy/rental-requests/:id/accept
2. Prisma interactive transaction (15s timeout):
   a. Lock property row, set isAvailable=false (optimistic lock)
   b. Set request status to ACCEPTED
   c. Reject all other PENDING requests for same property
   d. Link or create Conversation
3. Transaction retry loop (up to 3 attempts) for deadlock/P2002 handling
4. After transaction: create notifications, emitNotification for each affected user

### Flow 7: Tenant Starts Pre-Rental Conversation
1. POST /api/proxy/conversations with {propertyId}
2. Backend checks tenant is not owner, property exists
3. Checks for existing conversation (upsert pattern with P2002 catch for concurrency)
4. Creates Conversation with rentalRequestId=null

### Flow 8: User Sends a Message
1. POST /api/proxy/conversations/:id/messages
2. Backend: verify participant, validate content (1-2000 chars), create Message record
3. broadcastMessage(message) -> chatEventEmitter emits to all SSE listeners for that conversation
4. Creates CHAT_MESSAGE notification for recipient, emits via notificationEventEmitter

### Flow 9: Notification Marked as Read
1. NotificationContext.markAsRead(id) optimistic update
2. PUT /api/proxy/notifications/:id/read
3. Backend transaction: mark notification isRead, if CHAT_MESSAGE also mark messages read, count remaining unreads
4. emitNotification({type:NOTIFICATION_READ_SYNC, ...counts}) via SSE
5. Client updates unreadCount and unreadChatCount from server-provided values

### Flow 10: Header Counts Loaded and Updated
Initial: 3 parallel API calls (notifications list, unread count, unread chat count), SSE stream opened
Real-time: SSE events update counts. window custom events provide same-tab synchronization.

---

## Deployment Architecture

```
GitHub master branch
    |
    +-- Vercel (frontend)
    |   Root dir: frontend/
    |   Build: npm run build
    |   Env: NEXT_PUBLIC_BACKEND_URL
    |   Rewrite: /api/proxy/* -> https://rentgoer.onrender.com/api/*
    |
    +-- Render (backend)
        Root dir: backend/
        Build: npm install && npx prisma generate && npm run build
        Start: node dist/index.js
        Env: DATABASE_URL, DIRECT_URL, JWT_SECRET, FRONTEND_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

## Supabase Integration Details

- **PostgreSQL**: Primary database, via Prisma. DATABASE_URL (pooled), DIRECT_URL (for migrations).
- **Storage**: Property images stored at path properties/{propertyId}/{uuid}.{ext} in bucket `property-images`.
- **Service Role Key**: Backend uses SERVICE_ROLE_KEY which bypasses RLS. All access control is in Express.
- **RLS**: Not configured. Supabase Data API is not exposed to clients.
- **Supabase Realtime**: Not used. SSE is via in-process Node.js EventEmitter.
