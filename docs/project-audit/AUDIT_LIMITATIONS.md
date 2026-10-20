# Audit Scope & Limitations — RentGoer

**Audit Date:** October 20, 2026  
**Auditor:** Principal Software Architect & Technical Auditor  
**Scope:** Specification of verified artifacts, review boundaries, offline static constraints, and areas requiring live credentialed validation.

---

## 1. Scope of the Audit

This technical audit represents an in-depth, evidence-based architectural assessment of the **RentGoer** repository (`saksham0428/rentgoer`), examining:
- 100% of backend Express routes, controllers, middleware, and Prisma schemas.
- 100% of frontend Next.js App Router pages, layouts, contexts, and UI components.
- All 13 Prisma database migration scripts.
- All 34 test and scratch verification scripts in `backend/scratch/`.
- Deployment manifests (`render.yaml`, `DEPLOYMENT.md`, `next.config.ts`, `vercel.json`).

---

## 2. Unverified Dimensions & Limitations

Due to the static, offline nature of codebase analysis without active cloud administrative credentials, the following items could not be verified from repository files alone:

### 2.1 Live Production Database Alignment
- **What was verified:** The local schema file (`backend/prisma/schema.prisma`) and the 13 sequential SQL migration files under `backend/prisma/migrations/`.
- **What could not be verified:** Whether `npx prisma migrate deploy` was executed against the active production PostgreSQL database on Supabase, or whether the production database schema currently has drifted or pending unapplied migrations.
- **Verification Command Required:**
  ```bash
  DATABASE_URL="<production-direct-url>" npx prisma migrate status
  ```

### 2.2 Supabase Storage Bucket Policies & RLS
- **What was verified:** The backend uses `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` to upload images to the `property-images` bucket and generate public/signed URLs.
- **What could not be verified:** The PostgreSQL Row Level Security (RLS) policies, storage access policies, MIME-type whitelists, and CORS rules configured within the Supabase Cloud Web Dashboard.
- **Recommendation:** Manually inspect the `property-images` bucket settings in the Supabase Cloud Console to ensure direct client write access is disabled.

### 2.3 Live Environment Secrets & Entropy
- **What was verified:** Required environment variable names, fallback logic in `process.env`, and default configuration handling.
- **What could not be verified:** The actual values populated inside the Vercel and Render environment variable dashboards (e.g. whether `JWT_SECRET` in production is sufficiently random and has >= 256 bits of entropy).
- **Recommendation:** Verify in the Render Dashboard that `JWT_SECRET` is not using a development placeholder string.

### 2.4 Live Vercel & Render Runtime Health
- **What was verified:** The configuration files (`render.yaml`, `next.config.ts`), routing logic, rewrites, and the `/api/health` endpoint implementation.
- **What could not be verified:** Current live uptime, SSL certificate validity, whether Render free-tier sleep cycles are causing 50-second cold starts, and actual memory consumption during peak traffic.
- **Verification Action:** Query `GET https://rentgoer.onrender.com/api/health` and run `backend/scratch/smoke-test-production.ts`.

### 2.5 Real-World High-Concurrency SSE Saturation
- **What was verified:** Code concurrency safeguards (`prisma.$transaction`, optimistic locking, connection limits per user ID) and script tests (`test-concurrency-controllers.ts`).
- **What could not be verified:** Maximum simultaneous SSE socket saturation under Render's reverse proxy under thousands of concurrent active connections.
- **Recommendation:** Perform distributed load testing with `k6` or `Artillery` prior to large-scale marketing campaigns.
