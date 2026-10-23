# 09 — Deployment & operations

## Confirmed milestones
- [x] Frontend deployed to Vercel (`https://rentgoer.vercel.app`) with Next.js App Router
- [x] Backend deployed to Render (`https://rentgoer.onrender.com`) with Express and Node.js
- [x] Next.js rewrite proxy `/api/proxy/* -> BACKEND_URL/api/*` solving cross-domain SameSite=Lax cookie delivery (`frontend/next.config.ts:L4-14`)
- [x] Supabase Storage bucket `property-images` configured for property images with 5MB cap (`backend/src/config/supabase.ts`)
- [x] Production session migration applied and verified (all 14 Prisma migrations active in Supabase PostgreSQL)
- [x] Stage A production smoke checks reported healthy (`/api/health` and `/api/proxy/health` return HTTP 200)

## Remaining
- [ ] Document manual Render Cron Job configuration or manual cleanup execution procedure while automated cron is unprovisioned
- [ ] Document manual operational checks for sessions and database health
- [ ] Verify environment variables and deployment configuration during future releases
- [ ] Establish a rollback checklist for future authentication changes (clearly distinguishing disabling issuance from reverting code)
- [ ] Verify Supabase Storage bucket policies and RLS configuration in Supabase Dashboard (`AUDIT_LIMITATIONS.md:L32-36`)
- [ ] Verify live production secret entropy (`JWT_SECRET`, database passwords) in Render Dashboard (`AUDIT_LIMITATIONS.md:L38-41`)

