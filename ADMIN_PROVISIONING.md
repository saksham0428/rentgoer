# RentGoer — Administrator Provisioning Guide

This document defines the hardened, secure operational procedure for provisioning platform administrator accounts in RentGoer.

---

## 1. Security Architecture & Threat Model

1. **No Public HTTP Entry Point**:
   - Public registration (`POST /api/auth/register`) strictly rejects any request specifying `role: 'ADMIN'` with `403 Forbidden`.
   - The provisioning mechanism is implemented exclusively as an administrative CLI script (`backend/src/scripts/provision-admin.ts`), preventing web-based privilege escalation.
2. **Explicit Authorization Guard**:
   - Provisioning requires an environment-configured shared secret (`ADMIN_PROVISION_SECRET`, minimum 16 characters).
   - The script performs a timing-safe cryptographic comparison using SHA-256 hashes (`crypto.timingSafeEqual`) to prevent side-channel timing leaks.
3. **Fail-Safe Target Classification & Credential Masking**:
   - Only strictly recognized loopback hosts (`localhost`, `127.0.0.1`, `::1`, `[::1]`, and IPv4 `127.0.0.0/8`) are classified as local development environments.
   - All other hostnames (including `.local` mDNS domains, `host.docker.internal`, private LAN IPs, and cloud domains) are classified as remote.
   - The script does NOT rely on a hardcoded cloud domain list (`isKnownCloud`) to determine whether protection is necessary: all non-local targets are treated as remote and protected by default.
   - Connection credentials (usernames, passwords) and query parameters are completely redacted from terminal displays and log outputs.
4. **Cloud Target Identification & Non-Reversible Target Fingerprint**:
   - *Why host/database display alone is insufficient:* Cloud connection poolers (such as Supabase Transaction Pooler, AWS RDS Proxy, or Railway) often route multiple distinct staging, preview, and production databases through identical hostnames (`aws-0-ap-south-1.pooler.supabase.com:6543`) and identical database names (`postgres`). In addition, SSH port-forwarding or local tunnels can route `localhost:5432` to a remote production database.
   - *Safer Verification Mechanism:* The script calculates and displays a non-reversible cryptographic fingerprint (`SHA-256` hash truncated to 16 characters) combining protocol, tenant routing username, host, port, and database name. In addition, when routing through cloud poolers with tenant prefixes (e.g. `postgres.<project_ref>`), the alphanumeric project reference is extracted and displayed safely without leaking passwords.
   - A tunnel advisory warning is displayed whenever `localhost` is targeted.
5. **Dual-Lock Remote Target Protection**:
   - Provisioning against any non-local/remote database requires **BOTH**:
     1. Environment variable: `ALLOW_REMOTE_PROVISION="true"`
     2. Command-line flag: `--confirm-remote`
   - If either requirement is missing, execution is immediately rejected.
6. **Mandatory Explicit Target Confirmation**:
   - All actual provisioning writes require explicit target database confirmation (`--confirm-target` flag in automated flows, or an interactive `YES` prompt).
7. **Prohibition of Credential CLI Flags**:
   - Passing secrets or passwords via command-line arguments (such as `--secret=...` or `--password=...`) is strictly prohibited and immediately rejected by the argument parser.
   - Command-line arguments are exposed in process listings (`ps aux`), process monitors, and shell history files (`.bash_history`, `.zsh_history`, PowerShell PSReadLine).
   - In interactive mode, secrets and passwords are collected via masked prompts (`promptMasked`).
   - In non-interactive mode, secrets and passwords must be passed via scoped environment variables.
8. **Consistent Password Policy & Confirmation**:
   - Password policy requires a minimum of 8 characters, at least one uppercase letter, at least one lowercase letter, and at least one digit.
   - Confirmation matching is strictly required across both interactive flows (prompted twice) and non-interactive flows (`ADMIN_PASSWORD_CONFIRM` must be supplied and must match `ADMIN_PASSWORD`).
9. **Strict Separation of Creation from Promotion (Zero Mutation of Existing Accounts)**:
   - The script creates **new** administrator accounts only.
   - If the normalized email is already registered to any existing account (with role `ADMIN`, `TENANT`, or `OWNER`), the script immediately aborts without updating passwords, tokens, or roles.
   - Accidental role promotion and account takeovers are strictly prevented.
   - Concurrent creation race conditions are safely caught using the database's unique constraint on `User.email` (`P2002`).
10. **Clean Resource Management & Non-Abrupt Termination**:
    - The database client (`PrismaClient`) is instantiated only after pre-flight parameter and authorization validations pass.
    - `prisma.$disconnect()` is guaranteed to execute under all completion, error, and abort paths via `finally` blocks.
    - Internal execution logic avoids calling `process.exit()`, returning structured outcomes to a top-level error handler.
11. **Dry-Run Guarantees & Documented Limitations**:
    - Running with `--dry-run` performs a strictly read-only validation: it parses and classifies the target database, verifies the authorization secret, enforces credential syntax and password policy, and executes a read query (`findUnique`) to verify email availability.
    - Zero database writes are performed during a dry run.
    - *Dry-run limitations:* A passing dry run does NOT guarantee that future provisioning will succeed. Subsequent runs may still fail due to network pool exhaustion, write permission deficits for the database user, database triggers/locks, or concurrent registration.

---

## 2. Required Environment Variables

Configure these variables in `backend/.env` for local development, or supply them as scoped environment variables for execution.

> [!CAUTION]
> Never commit actual secret keys or credentials to version control. The values below are illustrative dummy placeholders.

| Variable | Required | Minimum Length | Description | Example / Dummy Placeholder |
|---|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/rentgoer_dev` |
| `ADMIN_PROVISION_SECRET` | **Yes** | 16 characters | Server-side authorization secret | `dummy_server_provision_secret_min16!` |
| `ADMIN_SECRET` | For non-interactive | 16 characters | Operator authorization secret matching `ADMIN_PROVISION_SECRET` | `dummy_server_provision_secret_min16!` |
| `ALLOW_REMOTE_PROVISION` | For remote DB only | — | Must be `"true"` to permit execution on non-localhost hosts | `false` (default) |
| `ADMIN_EMAIL` | Optional | — | Email for the administrator account | `admin@example.com` |
| `ADMIN_NAME` | Optional | — | Display name for the administrator | `Platform Administrator` |
| `ADMIN_PASSWORD` | Optional | 8 characters | Password (min 8 chars, mixed case & digit) | `DummyAdminPassword2026!` |
| `ADMIN_PASSWORD_CONFIRM` | If `ADMIN_PASSWORD` is set | 8 characters | Password confirmation (must match `ADMIN_PASSWORD`) | `DummyAdminPassword2026!` |

---

## 3. Step-by-Step Procedure: Local Development Provisioning

### Step 3.1: Configure Local Environment Variables
Ensure `backend/.env` contains your local development database connection and authorization secret:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rentgoer_dev"
ADMIN_PROVISION_SECRET="dummy_local_secret_for_testing_only_16chars!"
```

### Step 3.2: Execute Read-Only Dry Run Validation
Before performing any database write, run the script with `--dry-run` to validate your database connection, authorization secret, and credential parameters.

**Option A: Interactive Dry Run (Preferred)**
```bash
cd backend
npm run admin:provision -- --dry-run
```
The script will display the sanitized database target, prompt for confirmation, prompt for the authorization secret, email, name, and password, verify pre-conditions, and exit cleanly without inserting records.

**Option B: Non-Interactive Dry Run (Scoped Environment Variables)**
```bash
cd backend
ADMIN_SECRET="dummy_local_secret_for_testing_only_16chars!" \
ADMIN_EMAIL="admin.local@example.com" \
ADMIN_NAME="Local Administrator" \
ADMIN_PASSWORD="DummyPassword123!" \
ADMIN_PASSWORD_CONFIRM="DummyPassword123!" \
npm run admin:provision -- --dry-run --confirm-target
```

> [!NOTE]
> Passing secrets or passwords as CLI arguments (e.g. `--secret=...` or `--password=...`) is strictly rejected. Always use interactive masked input or scoped environment variables.

### Step 3.3: Execute Initial Admin Creation
Run the provisioning command interactively:
```bash
cd backend
npm run admin:provision
```

The script will:
1. Display the sanitized database host, database name, and non-reversible Target Fingerprint (`SHA-256`).
2. Prompt for explicit confirmation: `Are you sure you want to target this database? Type 'YES' to confirm:`.
3. Prompt for the `ADMIN_PROVISION_SECRET` with masked input (`*`).
4. Prompt for administrator email, name, and password (with masked confirmation).
5. Hash the password using bcrypt (10 rounds).
6. Create the administrator account with `role: ADMIN` and `tokenVersion: 0`.
7. Disconnect Prisma cleanly and report success.

---

## 4. How to Verify Creation Without Exposing Credentials

1. **Verify via `/api/health` and Login**:
   - Start the backend: `npm run dev` in `backend`.
   - Start the frontend: `npm run dev` in `frontend`.
   - Open `http://localhost:3000/login`.
   - Sign in using the provisioned email and password.
2. **Confirm Admin Center Routing**:
   - Upon authentication, the administrator is automatically redirected to `/admin`.
   - Confirm that platform overview metrics (`Total Users`, `Total Properties`, `Open Reports`, `Pending Verification`) render successfully.
   - Confirm that the top navigation bar displays the **"Admin Center"** and **"Moderation"** links.
3. **Verify Non-Admin Isolation**:
   - Log out and log in with an existing `TENANT` or `OWNER` account.
   - Attempt to navigate to `http://localhost:3000/admin`.
   - Confirm that the **403 Forbidden ("Administrator Access Required")** screen is displayed, and that no admin APIs can be called.

---

## 5. Runtime & Deployment Compatibility Analysis

### Repository & Deployment Environment Findings
An inspection of the repository's configuration reveals the following runtime realities:

1. **Package Dependency Classification**:
   - `tsx` is classified under `devDependencies` in `backend/package.json`.
   - In production environments where `NODE_ENV=production` or `npm prune --production` is enforced, `tsx` will not be present.
   - Running `npm run admin:provision` (which invokes `tsx src/scripts/provision-admin.ts`) will fail in pruned production container environments.
2. **Build Artifacts & Compiled Execution**:
   - The build script (`npm run build`) runs `tsc`, which compiles TypeScript source files in `src/` to JavaScript in `dist/`.
   - The compiled script `dist/scripts/provision-admin.js` runs directly on the Node.js runtime (`node dist/scripts/provision-admin.js` or `npm run admin:provision:dist`) without requiring `tsx` or any `devDependencies`.
   - All runtime dependencies (`@prisma/client`, `bcrypt`, `dotenv`) are correctly located in `dependencies`.
3. **Render Deployment Platform Verification**:
   - `backend/render.yaml` specifies a single `web` service (`rentgoer-backend`).
   - The repository configuration does NOT define a background worker, persistent shell, or one-off task runner.
   - Standard Web Services on Render do not guarantee persistent shell access or interactive TTY support.
   - **Status:** Production CLI execution inside a live Render container remains **unverified** without explicit infrastructure setup or paid plan SSH capabilities.

### Risks of Environment Variables in Non-Interactive Execution
When provisioning without an interactive TTY, secrets are passed via environment variables (`ADMIN_SECRET`, `ADMIN_PASSWORD`). Operators must recognize the associated risks:
- Process table visibility (`/proc/<pid>/environ`) on multi-tenant or compromised hosts.
- Unintentional logging in continuous integration runner logs if debug flags (`set -x`) are active.
- Image or container metadata leakage if environment variables are persisted in container manifests.

**Mitigations:**
- Use command-scoped environment variables that expire when the process terminates.
- Rotate or unset `ADMIN_PROVISION_SECRET` immediately after provisioning.
- Require `ADMIN_PASSWORD_CONFIRM` in non-interactive flows to prevent accidental lockout from typos.

---

## 6. Recommended Production Provisioning Protocol (Future Reviewed Operation)

> [!IMPORTANT]
> Administrative provisioning on production must **never** be performed during routine development or without multi-engineer review and explicit organizational authorization.

When production administrator onboarding is formally scheduled:

1. **Change Management & Authorization**:
   - Secure written authorization and ticket approval for the designated administrator's email and role.
   - Schedule an approved operational change window.
2. **Temporary Authorization Secret Injection**:
   - Generate a cryptographically secure random secret (32+ characters):
     ```bash
     openssl rand -hex 24
     ```
   - Temporarily inject `ADMIN_PROVISION_SECRET=<secret>` into the production backend environment settings via the Render dashboard.
3. **Execution Options**:
   - **Option A (Secure Admin Workstation / Bastion — Recommended)**:
     Execute the compiled script locally connecting to the production database via a secured direct URL, requiring the dual-lock flags:
     ```bash
     cd backend
     ALLOW_REMOTE_PROVISION="true" \
     ADMIN_SECRET="<secret>" \
     ADMIN_EMAIL="security-admin@rentgoer.com" \
     ADMIN_NAME="Platform Administrator" \
     node dist/scripts/provision-admin.js --confirm-remote --confirm-target
     ```
   - **Option B (Render One-Off Job / Web Shell if enabled)**:
     If a secure Render shell or one-off job container is available:
     ```bash
     ALLOW_REMOTE_PROVISION="true" \
     ADMIN_SECRET="<secret>" \
     ADMIN_EMAIL="security-admin@rentgoer.com" \
     ADMIN_NAME="Platform Administrator" \
     node dist/scripts/provision-admin.js --confirm-remote --confirm-target
     ```
4. **Post-Provisioning Cleanup & Verification**:
   - Immediately remove or rotate `ADMIN_PROVISION_SECRET` in the Render environment.
   - Ensure `ALLOW_REMOTE_PROVISION` is unset or set to `false`.
   - Log in at the production URL (`https://rentgoer.vercel.app/login`) to verify access.
   - Audit the database `User` table to verify that only one record with the expected email was created.
