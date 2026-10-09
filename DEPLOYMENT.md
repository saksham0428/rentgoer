# RentGoer Deployment Guide

## 1. Architecture
- **Frontend**: Next.js App Router (deployed to Vercel)
- **Backend**: Node.js / Express / REST + SSE (deployed to Render/Railway)
- **Database & Storage**: Supabase PostgreSQL and Supabase Storage (already configured)

## 2. Frontend Platform (Vercel)
The frontend is configured for zero-config Vercel deployment. The root directory must be set to `frontend`.
### Vercel Project Settings
- **Framework Preset**: Next.js
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Install Command**: `npm install`
- **Output Directory**: `.next`

A `vercel.json` file is already included in the `frontend` directory to enforce these settings.

### Environment Variables
**Do not hardcode secrets here. Inject them via Vercel Dashboard:**
- `NEXT_PUBLIC_BACKEND_URL`: The deployed backend URL (e.g., `https://rentgoer-api.onrender.com`). Used by the API proxy.

## 3. Backend Platform (Render)
A `render.yaml` Blueprint is provided for 1-click deployment on Render.
### Environment Variables
**Do not hardcode secrets here. Inject them via Render/Railway Dashboard:**
- `NODE_ENV`: `production`
- `PORT`: `5000` (Injected automatically by Render/Railway)
- `FRONTEND_URL`: The deployed frontend URL (e.g., `https://rentgoer-frontend.vercel.app`) - **Crucial for CORS**
- `DATABASE_URL`: Connection string (Transaction pooled via Supabase)
- `DIRECT_URL`: Direct connection string for Prisma migrations
- `JWT_SECRET`: Secure random string for authentication
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for Storage/Admin)
- `AUTH_RATE_LIMIT_MAX`: `50`
- `API_RATE_LIMIT_MAX`: `1000`
- `NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER`: `3`
- `CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER`: `5`

## 4. Build Commands
- **Frontend**: `npm run build`
- **Backend**: `npm install && npx prisma generate && npm run build`

## 5. Start Commands
- **Frontend**: `npm start` (Vercel handles this natively)
- **Backend**: `npm start`

## 6. Prisma Migration Command
Once the backend is live, execute migrations against production using:
`npx prisma migrate deploy`
**NEVER** use `prisma migrate reset` in production.

## 7. Health Endpoint
To verify the backend deployment is active, navigate to:
`GET /api/health`

## 8. CORS Configuration
The backend explicitly relies on `FRONTEND_URL`. No wildcard (`*`) origins are permitted. Ensure `FRONTEND_URL` exactly matches your Vercel URL without trailing slashes.

## 9. Cookie Configuration
Authentication uses `HttpOnly` cookies named `rentgoer_token`.
In production (`NODE_ENV=production`), these cookies have `Secure: true` and `SameSite: Lax`.

**IMPORTANT: Vercel-to-Render Cross-Site Cookie Issue**
Because the frontend is hosted on Vercel (`.vercel.app`) and the backend is on Render (`.onrender.com`), they operate on completely different domains. Modern browsers consider XHR/Fetch API requests between these domains as cross-site.
Browsers strictly block sending `SameSite=Lax` cookies on cross-site requests. Therefore, direct API requests from the Vercel frontend to the Render backend will fail to attach the authentication cookie, breaking the app in production.

**Safe Solution (Required):**
Do NOT weaken the cookie security to `SameSite: None`. Instead, configure a Next.js Rewrite in the frontend to proxy API requests to the backend. This way, the browser talks only to the Vercel domain, keeping everything same-site.
1. Set the Vercel frontend `NEXT_PUBLIC_API_URL` environment variable to `/api/proxy` (or similar).
2. Add a rewrite rule in `next.config.ts`:
   ```ts
   async rewrites() {
     return [
       {
         source: "/api/proxy/:path*",
         destination: "https://rentgoer-api.onrender.com/api/:path*", // The Render backend
       },
     ];
   }
   ```
This API proxy has been implemented natively in the frontend to resolve all cross-site cookie challenges.

## 10. Storage Configuration
The Supabase bucket `property-images` is strictly utilized via signed URLs and direct backend streams. File sizes are capped at 5MB per upload.

## 11. SSE Considerations
Server-Sent Events (Notifications & Chat) are stateful. The `render.yaml` provisions standard Node environment settings, but be aware that serverless platforms (like Vercel functions) aggressively terminate SSE. This is why the Backend **must** be deployed to a persistent container platform like Render or Railway.

## 12. Rollback Considerations
If a deployment fails, use the native rollback features of Vercel/Render. Ensure that Prisma migrations are carefully evaluated before rollback, as rolling back Node.js code does not automatically revert database schema changes.

## 13. Safe Redeployment Process
1. Push to GitHub (`master`/`main` branch).
2. Vercel automatically deploys the frontend.
3. Render automatically triggers the backend build (`npm install && npx prisma generate && npm run build`).
4. Render runs the start command.
5. Verify `/api/health`.
