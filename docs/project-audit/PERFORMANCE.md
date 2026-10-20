# Performance Audit — RentGoer

---

## Database Query Analysis

### getProperties (property.controller.ts)

This is the most critical performance endpoint — it serves the property listing page, which every user hits.

```
Query 1: prisma.property.findMany({
  where: filters,
  include: { images: true, owner: { select: ... } },
  skip: (page-1)*limit,
  take: limit
})
Query 2: prisma.review.groupBy({
  by: ['propertyId'],
  where: { propertyId: { in: propertyIds } },
  _avg: { rating: true },
  _count: { id: true }
})
```

Observations:
- Two queries per page request (property list + review aggregates)
- Images are always included. If a property has 10 images, all 10 image records are fetched even when only the first is needed for the card thumbnail.
- The (city, locality) composite index covers the most common filter combination
- sortBy='verified' sorts by isVerified desc then createdAt desc — no composite index covers this; potential full-table sort at scale

Recommendation:
- Add a query to only fetch the first image per property (e.g., orderBy createdAt asc, take 1) for list views, and fetch all images only in detail view
- Or denormalize a primaryImageUrl on the Property model
- Add composite index on (isVerified, createdAt) for verified sort order

### Auth Middleware (every authenticated request)

Every request through authMiddleware hits the database:
```
prisma.user.findUnique({ where: { id: decoded.id }, select: { id, role, tokenVersion } })
```

Observations:
- This is a point lookup by primary key (UUID) — extremely fast
- But for SSE keepalive (which writes : ping every 20s), the 20-second connection stays open without re-authing — so this is NOT called on every ping, only on the initial SSE connection setup
- The concern is for chatty REST APIs: a single page that fires 5 parallel requests on mount hits auth middleware 5 times

Remediation (P2): a per-process in-memory LRU cache keyed by (userId, tokenVersion) with a 60-second TTL would cut DB roundtrips by ~80% in active sessions. Acceptable revocation lag: 60 seconds.

### sendMessage / createRentalRequest / acceptRequest

sendMessage: 1 participant check + 1 message create + 1 conversation update + 1 notification create + 1 notify emit = 5 operations, no transaction. Acceptable.

createRentalRequest: 1 property check + 1 existing request check + 1 create + 1 notification create + 1 notify emit = 5 operations. No transaction. In theory, two concurrent requests from the same tenant for the same property could both pass the "no existing request" check. The unique constraint does not exist on (tenantId, propertyId, status). A rare race condition.

acceptRequest: Interactive transaction with up to 3 retries. Transaction includes: 2 updateMany + 1 findFirst + 1 create/update + multiple rejects. Heavy but correct. The retry loop is properly bounded.

---

## N+1 Query Analysis

### getProperties — Not N+1
The images and owner are included in the main findMany query. The groupBy is a single batched query for all properties on the page. No N+1.

### getOwnerRequests — Potential N+1
getOwnerRequests fetches requests with include: property, tenant. No identified N+1 here.

### getAdminReportById — Minor N+N
After fetching the report, a second lookup is done for the target (property, user, or message). This is a single extra query per report detail view — acceptable.

---

## SSE Performance Characteristics

### Notification SSE
- One EventSource connection per logged-in user
- Backend holds the Node.js response object open
- No keepalive ping in notification SSE — relies on browser reconnect behavior
- Risk: Nginx/Render proxy may close idle connections after 60 seconds. Recommend adding keepalive pings to notification SSE (same as chat SSE does with 20s intervals).

### Chat SSE
- One EventSource per open conversation per user
- 20-second keepalive pings implemented
- Memory usage: each open SSE connection holds the res object + event listener. At 1000 concurrent users with 2 conversations open each: 2000 listeners + 2000 response objects. Manageable on a single Render instance.

---

## Prisma Query Logging in Production

Evidence: backend/src/lib/prisma.ts L9 — log: ['query', 'error', 'warn']

Every SQL query is logged to stdout in production. On Render, this goes to the service log stream. At scale:
- 100 requests/second * average 3 queries/request = 300 log lines/second
- This fills Render's log buffer rapidly and makes debugging harder
- It may also include query parameters (potential data exposure in logs)

Immediate fix (P0):
```typescript
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
});
```

---

## Image Handling Performance

### Upload Path
- multer memoryStorage buffers entire file in Node.js memory before upload
- 5 files * 5MB = up to 25MB in memory per request
- At 10 concurrent uploads: 250MB memory spike
- For the current scale (single Render instance, low traffic) this is acceptable
- At scale: stream directly from request body to Supabase (requires custom multer storage engine or different upload approach)

### Delivery Path
- Images served directly from Supabase public storage URLs
- No CDN layer beyond Supabase's own infrastructure
- No resizing or optimization — original uploaded images served to all clients
- Next.js Image component (next/image) can optimize if given the remotePatterns configuration (configured in next.config.ts for *.supabase.co)
- PropertyCard uses standard img tags or next/image — verify in components

---

## Frontend Performance

### In-Flight Request Deduplication (api.ts)
- Client-side GET requests to the same URL at the same time are deduplicated
- inFlightGetRequests Map returns the same Promise for concurrent identical calls
- This prevents the "waterfall" problem when multiple components mount simultaneously and call the same endpoint
- Example: Navbar, page component, and FavoritesContext may all call /auth/me on mount — only one actual fetch fires

### Context Re-render Optimization
- useMemo on all context values prevents unnecessary consumer re-renders
- useCallback on all context functions prevents recreation per render
- useRef for SSE callback (onNewMessageRef) prevents EventSource recreation on every render

### Potential Client Bundle Issues
- lucide-react exports 1500+ icons. If tree-shaking is not configured correctly, all icons could be bundled
- Next.js with Turbopack should handle tree-shaking for named imports (e.g., import { Search } from 'lucide-react')
- Verify bundle size with next build --profile or similar

---

## Caching Recommendations

| Layer | What to Cache | TTL | Priority |
|---|---|---|---|
| Backend in-memory | tokenVersion per userId | 60s | P2 |
| Backend in-memory or Redis | Property list for popular city/locality combos | 5min | P3 |
| CDN (Cloudflare, Vercel Edge) | GET /properties (public) | 30s-5min with stale-while-revalidate | P3 |
| Next.js unstable_cache / ISR | Property detail pages | 5min | P3 |
| Database | (isVerified, createdAt) composite index | N/A (schema change) | P2 |

---

## Concurrent User Estimates (Single Render Instance)

Render free/starter tier provides 512MB RAM and shared CPU.

| Scenario | Memory estimate |
|---|---|
| 100 concurrent SSE connections (notification + chat) | ~100MB (2 listeners + res per user) |
| 10 concurrent image uploads (25MB each) | ~250MB spikes |
| 50 concurrent REST requests | ~50MB for concurrent work |
| Base Node.js + Prisma + Express | ~150MB |
| Total estimate (100 active users) | ~550MB — tight on 512MB Render starter |

Recommendation: Upgrade to Render standard tier (1GB RAM) for production. This resolves the image upload memory concern and provides headroom for SSE connections.
