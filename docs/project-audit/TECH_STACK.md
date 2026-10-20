# Technology Stack and Dependency Audit

## Runtimes and Languages

| Item | Value | Source |
|---|---|---|
| Node.js runtime | Not pinned in package.json; Render uses latest LTS by default | render.yaml |
| TypeScript (frontend) | ^5 | frontend/package.json |
| TypeScript (backend) | ^7.0.2 | backend/package.json |
| Next.js | 16.4.0 (pinned) | frontend/package.json |
| React | 19.3.0 (pinned) | frontend/package.json |
| Express | ^5.2.1 | backend/package.json |

**Note:** TypeScript 7.x is extremely new (as of 2026). Verify compatibility with all tooling and check for known issues before upgrade.

---

## Frontend Dependencies

### Runtime Dependencies (5)

| Package | Version | Purpose | Used In | Essential? |
|---|---|---|---|---|
| next | 16.4.0 | App Router, SSR, API proxy rewrites | All frontend pages | Essential |
| react | 19.3.0 | UI component tree | All components | Essential |
| react-dom | 19.3.0 | DOM rendering | root layout | Essential |
| lucide-react | ^1.52.0 | Icon library (150+ icons used) | Navbar, pages, components | Essential (replaceable but widely used) |
| date-fns | ^4.4.0 | Date formatting in chat timestamps | chat page components | Low — only basic formatDistanceToNow used; can be replaced with Intl.RelativeTimeFormat |

### Dev Dependencies (6)

| Package | Version | Purpose |
|---|---|---|
| @tailwindcss/turbopack | ^4 | Tailwind v4 Turbopack loader |
| tailwindcss | ^4 | Utility CSS framework |
| @types/node | ^20 | Node.js types |
| @types/react | ^19 | React types |
| @types/react-dom | ^19 | React DOM types |
| eslint | ^9 | Linting |
| eslint-config-next | 16.4.0 | Next.js ESLint config |
| typescript | ^5 | TypeScript compiler |

**Note on Tailwind v4:** Tailwind CSS v4 is a major rewrite with no config file, PostCSS-free setup, and CSS-first configuration. The project uses @tailwindcss/turbopack for the Turbopack dev server. This is a very new setup — verify CSS variable names and compatibility with globals.css if migrating.

---

## Backend Dependencies

### Runtime Dependencies (17)

| Package | Version | Purpose | Used In | Essential? |
|---|---|---|---|---|
| @prisma/client | ^6.19.3 | Database ORM client | All controllers | Essential |
| @supabase/supabase-js | ^2.117.3 | Supabase Storage client | property-image.controller.ts | Essential for storage |
| bcrypt | ^6.0.0 | Password hashing and comparison | auth.controller.ts | Essential |
| cookie-parser | ^1.4.7 | Parses HttpOnly cookie from request | index.ts (global middleware) | Essential |
| cors | ^2.8.6 | Cross-origin request configuration | index.ts | Essential |
| dotenv | ^18.0.6 | Environment variable loading | index.ts | Essential |
| express | ^5.2.1 | HTTP server framework | index.ts and all routes | Essential |
| express-rate-limit | ^8.7.1 | Rate limiting for auth and general API | auth.routes.ts, index.ts | Essential for security |
| helmet | ^8.3.0 | HTTP security headers | index.ts | Essential for security |
| jsonwebtoken | ^9.0.3 | JWT sign and verify | auth.controller.ts, auth.middleware.ts | Essential |
| mime-types | ^3.0.2 | MIME to file extension conversion | property-image.controller.ts | Low — only used for ext lookup; replaceable |
| multer | ^2.4.0 | Multipart file upload parsing | upload.middleware.ts | Essential for image uploads |
| uuid | ^14.0.2 | UUID generation for storage paths | property-image.controller.ts | Low — Node crypto.randomUUID() is available |
| prisma | ^6.19.3 | Prisma CLI (generate, migrate) | build command | Essential at build time |
| @types/bcrypt | ^6.0.0 | TypeScript types | (types only) | Dev |
| @types/cookie-parser | ^1.4.10 | TypeScript types | (types only) | Dev |
| @types/cors | ^2.8.19 | TypeScript types | (types only) | Dev |
| @types/express | ^5.0.6 | TypeScript types | (types only) | Dev |
| @types/jsonwebtoken | ^9.0.10 | TypeScript types | (types only) | Dev |
| @types/mime-types | ^3.0.1 | TypeScript types | (types only) | Dev |
| @types/multer | ^2.3.0 | TypeScript types | (types only) | Dev |
| @types/node | ^26.6.4 | Node.js TypeScript types | (types only) | Dev |
| @types/uuid | ^10.0.0 | TypeScript types | (types only) | Dev |
| typescript | ^7.0.2 | TypeScript compiler | build | Dev |

### Dev-Only Dependencies (5)

| Package | Purpose |
|---|---|
| @types/eventsource | Types for SSE client in test scripts |
| @types/form-data | Types for multipart in test scripts |
| @types/node-fetch | Types for node-fetch in test scripts |
| eventsource | SSE client for scratch tests |
| form-data | Multipart builder for scratch tests |
| node-fetch | HTTP client for scratch tests |
| tsx | TypeScript executor for dev and scratch scripts |

---

## Suspected Removable / Replaceable Dependencies

| Package | Reason | Risk if Removed |
|---|---|---|
| uuid | crypto.randomUUID() in Node 15+ does the same thing | Low — one file to update |
| mime-types | Only used to get extension from MIME type; built-in lookup possible | Low |
| date-fns | Only formatDistanceToNow used; Intl.RelativeTimeFormat can replace | Low — check browser support |

---

## Missing Dependencies (Known Gaps)

| Missing | Why Needed |
|---|---|
| Email service (Nodemailer, Resend, SendGrid) | No transactional emails sent at any lifecycle event |
| Monitoring/error tracking (Sentry) | No exception telemetry |
| Structured logging (Pino, Winston) | console.error only |
| Redis / Upstash | Required if SSE is to survive horizontal scaling |
| Zod or similar validation library | Validation is hand-coded inline; a schema validator would reduce boilerplate |

---

## AI, Analytics, Payment, Maps — None Present

No third-party AI, analytics, payment, or map integration packages are installed. The database schema stores latitude and longitude fields but no map rendering library is present.

---

## Build and Deployment Tools

| Tool | Where |
|---|---|
| tsc | Backend TypeScript build (npm run build -> tsc) |
| tsx | Backend dev server (tsx watch src/index.ts) |
| Next.js | Frontend build and dev server |
| Turbopack | Frontend dev bundler (via @tailwindcss/turbopack) |
| Prisma CLI | Schema management and migrations |
