# RentGoer Deployment Guide

## 1. Architecture
- **Frontend**: Next.js App Router (deployed to Vercel)
- **Backend**: Node.js / Express / REST + SSE (deployed to Render/Railway)
- **Database & Storage**: Supabase PostgreSQL and Supabase Storage (already configured)

## 2. Frontend Platform (Vercel)
The frontend is configured for zero-config Vercel deployment. A `vercel.json` file is included for explicit build settings.
### Environment Variables
- `NEXT_PUBLIC_API_URL`: The deployed backend URL (e.g., `https://rentgoer-backend.onrender.com/api`)

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
In production (`NODE_ENV=production`), these cookies have `Secure: true` and `SameSite: Lax`. Because both Vercel and Render provide HTTPS endpoints, cookies will transfer successfully across the public internet as long as cross-site navigations strictly utilize POST/PUT/DELETE for mutations.

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
