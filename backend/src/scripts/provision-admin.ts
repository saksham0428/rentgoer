import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

/**
 * Deterministically loads environment variables from backend/.env if available.
 * Safe for containerized environments where environment variables are injected directly.
 */
export function loadEnvironment(): void {
  const envPath = path.resolve(__dirname, '../../.env');
  dotenv.config({ path: envPath });
}

loadEnvironment();

/**
 * Sanitizes any message by redacting connection strings, passwords, or secrets.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';
  return message
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED_CREDENTIALS]@')
    .replace(/(?:password|secret|key|token)[=:]\s*([^\s&,;]+)/gi, (match, val) =>
      match.replace(val, '[REDACTED]')
    );
}

/**
 * Parses a raw database URL and extracts sanitized details without exposing credentials.
 * Computes a non-reversible cryptographic fingerprint (SHA-256) of the target connection
 * to allow operators to verify target database identity without credential leakage.
 */
export function sanitizeDatabaseUrl(rawUrl?: string): {
  sanitizedDisplay: string;
  hostname: string;
  port: string;
  dbName: string;
  isLocal: boolean;
  targetFingerprint: string;
  projectRef?: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('DATABASE_URL is not configured in the environment.');
  }

  try {
    const parsed = new URL(rawUrl);
    const hostname = (parsed.hostname || 'unknown').toLowerCase();
    const port = parsed.port || '5432';
    const dbName = parsed.pathname.replace(/^\//, '') || 'unknown';

    // Strict local development host classification:
    // Only explicitly recognized loopback interfaces are considered local.
    // Hostnames like .local (mDNS) or host.docker.internal are NOT treated as local.
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);

    // Cryptographic target fingerprint (non-reversible SHA-256)
    // Combines protocol, username, hostname, port, and database name.
    const normalizedIdentity = `${parsed.protocol}//${parsed.username || ''}@${hostname}:${port}/${dbName}`;
    const targetFingerprint = crypto
      .createHash('sha256')
      .update(normalizedIdentity)
      .digest('hex')
      .slice(0, 16);

    // Safely extract tenant/project reference if available (e.g. Supabase pooler username "postgres.myprojectref")
    let projectRef: string | undefined;
    if (parsed.username && parsed.username.includes('.')) {
      const parts = parsed.username.split('.');
      if (parts.length >= 2 && /^[a-z0-9_-]+$/i.test(parts[1])) {
        projectRef = parts[1];
      }
    }

    const details: string[] = [
      `Target Host: ${hostname}:${port}`,
      `Database: ${dbName}`,
      `Environment: ${isLocal ? 'Local / Development Host' : 'Remote / Cloud Host'}`,
      `Target Fingerprint (SHA-256): ${targetFingerprint}`,
    ];

    if (projectRef) {
      details.push(`Project Ref: ${projectRef}`);
    }

    if (isLocal) {
      details.push('Advisory: If an SSH tunnel or port-forward is active, localhost may route to a remote database');
    }

    const sanitizedDisplay = details.join(' | ');

    return {
      sanitizedDisplay,
      hostname,
      port,
      dbName,
      isLocal,
      targetFingerprint,
      projectRef,
    };
  } catch (err: any) {
    if (err.message && err.message.includes('DATABASE_URL is not configured')) {
      throw err;
    }
    throw new Error('DATABASE_URL is malformed and could not be securely parsed.');
  }
}

/**
 * Verifies the database targeting to prevent accidental execution against remote/production environments.
 * Remote execution requires BOTH ALLOW_REMOTE_PROVISION=true AND --confirm-remote.
 * Actual provisioning requires explicit target confirmation (--confirm-target or interactive confirmation).
 */
export function validateTargetEnvironment(
  targetInfo: ReturnType<typeof sanitizeDatabaseUrl>,
  options: { allowRemote?: boolean; confirmTarget?: boolean }
): { allowed: boolean; reason?: string } {
  // Guard against remote database execution unless explicitly permitted by BOTH env and flag
  if (!targetInfo.isLocal) {
    const envAllowRemote = process.env.ALLOW_REMOTE_PROVISION === 'true';
    const flagAllowRemote = options.allowRemote === true;

    if (!envAllowRemote || !flagAllowRemote) {
      const missing: string[] = [];
      if (!envAllowRemote) {
        missing.push('ALLOW_REMOTE_PROVISION=true environment variable');
      }
      if (!flagAllowRemote) {
        missing.push('--confirm-remote command-line flag');
      }

      return {
        allowed: false,
        reason:
          `Target database is a non-local/remote host (${targetInfo.hostname}). ` +
          `Remote provisioning is locked by default to prevent accidental modifications of remote environments. ` +
          `Execution against a remote database requires BOTH: ` +
          missing.join(' AND ') +
          `.`,
      };
    }
  }

  // Require explicit confirmation for target database
  if (!options.confirmTarget) {
    return {
      allowed: false,
      reason:
        'Explicit confirmation of the target database (--confirm-target flag or interactive YES response) is required.',
    };
  }

  return { allowed: true };
}

/**
 * Constant-time comparison for authorization secret to prevent timing leaks.
 */
export function verifyAuthorizationSecret(
  providedSecret?: string,
  expectedSecret?: string
): { authorized: boolean; reason?: string } {
  if (!expectedSecret || expectedSecret.trim().length < 16) {
    return {
      authorized: false,
      reason:
        'ADMIN_PROVISION_SECRET is not configured or too weak in the environment (must be at least 16 characters). ' +
        'Configure a strong ADMIN_PROVISION_SECRET before provisioning.',
    };
  }

  if (!providedSecret || providedSecret.trim().length === 0) {
    return {
      authorized: false,
      reason: 'Missing provisioning authorization secret. Provide via ADMIN_SECRET environment variable or interactive prompt.',
    };
  }

  // Timing-safe comparison using SHA-256 hashes of both strings
  const hashProvided = crypto.createHash('sha256').update(providedSecret.trim()).digest();
  const hashExpected = crypto.createHash('sha256').update(expectedSecret.trim()).digest();

  if (!crypto.timingSafeEqual(hashProvided, hashExpected)) {
    return {
      authorized: false,
      reason: 'Authorization failed. The provided provisioning secret does not match ADMIN_PROVISION_SECRET.',
    };
  }

  return { authorized: true };
}

/**
 * Validates and normalizes administrator credentials before persistence.
 * Enforces consistent password validation and confirmation across interactive and non-interactive flows.
 */
export function validateAdminInputs(
  email?: string,
  name?: string,
  password?: string,
  confirmPassword?: string
): {
  valid: boolean;
  normalizedEmail: string;
  normalizedName: string;
  reason?: string;
} {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedName = (name || '').trim();

  if (!normalizedEmail) {
    return { valid: false, normalizedEmail: '', normalizedName: '', reason: 'Email address is required.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 255) {
    return { valid: false, normalizedEmail: '', normalizedName: '', reason: `Invalid email address format: "${normalizedEmail}".` };
  }

  if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 60) {
    return { valid: false, normalizedEmail: '', normalizedName: '', reason: 'Administrator name must be between 2 and 60 characters.' };
  }

  if (!password || password.length < 8) {
    return { valid: false, normalizedEmail: '', normalizedName: '', reason: 'Password must be at least 8 characters long.' };
  }

  // Enforce password complexity: at least 1 uppercase, 1 lowercase, 1 digit
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasDigit) {
    return {
      valid: false,
      normalizedEmail: '',
      normalizedName: '',
      reason: 'Password does not meet complexity requirements: must contain at least one uppercase letter, one lowercase letter, and one number.',
    };
  }

  // If confirmPassword is provided, verify match
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return {
      valid: false,
      normalizedEmail: '',
      normalizedName: '',
      reason: 'Password confirmation does not match.',
    };
  }

  return { valid: true, normalizedEmail, normalizedName };
}

export interface ParsedProvisioningArgs {
  help: boolean;
  dryRun: boolean;
  confirmTarget: boolean;
  confirmRemote: boolean;
  email?: string;
  name?: string;
}

/**
 * Parses command-line arguments.
 * Strictly rejects dangerous credential flags (--secret, --password) to prevent exposure
 * in shell history files and system process tables (ps aux).
 */
export function parseProvisioningArgs(args: string[]): ParsedProvisioningArgs {
  const result: ParsedProvisioningArgs = {
    help: false,
    dryRun: false,
    confirmTarget: false,
    confirmRemote: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }

    // Strictly reject secrets and passwords passed as CLI arguments
    if (arg === '--secret' || arg.startsWith('--secret=') || arg === '-s') {
      throw new Error(
        'Security Violation: Passing secrets via command-line arguments (--secret) is disallowed. ' +
        'CLI arguments are exposed in process listings (ps aux) and shell history files. ' +
        'Use the interactive masked prompt or provide the secret via the ADMIN_SECRET environment variable.'
      );
    }

    if (arg === '--password' || arg.startsWith('--password=') || arg === '-p') {
      throw new Error(
        'Security Violation: Passing passwords via command-line arguments (--password) is disallowed. ' +
        'CLI arguments are exposed in process listings (ps aux) and shell history files. ' +
        'Use the interactive masked prompt or provide the password via the ADMIN_PASSWORD environment variable.'
      );
    }

    if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--confirm-target') {
      result.confirmTarget = true;
    } else if (arg === '--confirm-remote') {
      result.confirmRemote = true;
    } else if (arg.startsWith('--email=')) {
      result.email = arg.slice('--email='.length);
    } else if (arg.startsWith('--name=')) {
      result.name = arg.slice('--name='.length);
    } else if (arg.startsWith('--')) {
      const [key] = arg.slice(2).split('=');
      throw new Error(`Unrecognized command-line argument: --${key}. Run with --help for valid options.`);
    }
  }

  return result;
}

/**
 * Interactive masked prompt for sensitive input (does not echo characters to screen/logs).
 * Does not terminate the process on Ctrl+C; restores terminal state and rejects promise.
 */
export async function promptMasked(queryText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    process.stdout.write(queryText);
    let input = '';

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();

      const onData = (chunk: Buffer) => {
        const char = chunk.toString();
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          // Ctrl+C: Clean up terminal and abort without calling process.exit()
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\nAborted.\n');
          rl.close();
          reject(new Error('Operation cancelled by user (Ctrl+C).'));
        } else if (char === '\b' || char === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Interactive standard line prompt.
 */
export async function promptLine(queryText: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export interface ProvisioningResult {
  success: boolean;
  message?: string;
  isDryRun?: boolean;
  createdUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
}

/**
 * Core admin provisioning execution logic.
 * Avoids process.exit() inside cleanup-sensitive paths; returns structured results.
 * Connects to the database only after all pre-flight parameter and authorization checks pass.
 * Disconnects Prisma reliably under all normal and error paths.
 */
export async function runProvisioning(
  customPrisma?: any,
  argv: string[] = process.argv.slice(2)
): Promise<ProvisioningResult> {
  console.log('===============================================================');
  console.log('🛡️  RentGoer Restricted Administrator Provisioning CLI');
  console.log('===============================================================\n');

  // 1. Argument Parsing (strictly validates flags, rejects CLI secrets/passwords)
  let parsedArgs: ParsedProvisioningArgs;
  try {
    parsedArgs = parseProvisioningArgs(argv);
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
    };
  }

  if (parsedArgs.help) {
    printHelp();
    return { success: true, message: 'Help documentation displayed.' };
  }

  // 2. Database Target Inspection & Sanitization
  let targetInfo: ReturnType<typeof sanitizeDatabaseUrl>;
  try {
    targetInfo = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  } catch (err: any) {
    return {
      success: false,
      message: `Database Configuration Error: ${err.message}`,
    };
  }

  console.log('Target Database Information:');
  console.log(`  ${targetInfo.sanitizedDisplay}`);
  console.log('  Credentials: [REDACTED]\n');

  // Check confirmation for target database
  let targetConfirmed = parsedArgs.confirmTarget === true;
  if (!targetConfirmed) {
    if (process.stdin.isTTY) {
      const reply = await promptLine(
        `Are you sure you want to target this database? Type 'YES' to confirm: `
      );
      targetConfirmed = reply === 'YES';
    }
  }

  const targetValidation = validateTargetEnvironment(targetInfo, {
    allowRemote: parsedArgs.confirmRemote === true,
    confirmTarget: targetConfirmed,
  });

  if (!targetValidation.allowed) {
    return {
      success: false,
      message: `Target Validation Failed: ${targetValidation.reason}`,
    };
  }

  // 3. Explicit Provisioning Authorization Check
  const expectedSecret = process.env.ADMIN_PROVISION_SECRET;
  let providedSecret = process.env.ADMIN_SECRET;

  if (!providedSecret && process.stdin.isTTY) {
    try {
      providedSecret = await promptMasked('Enter ADMIN_PROVISION_SECRET: ');
    } catch (abortErr: any) {
      return { success: false, message: abortErr.message };
    }
  }

  const authCheck = verifyAuthorizationSecret(providedSecret, expectedSecret);
  if (!authCheck.authorized) {
    return {
      success: false,
      message: `Provisioning Authorization Error: ${authCheck.reason}`,
    };
  }
  console.log('✓ Authorization secret verified successfully.');

  // 4. Administrator Credentials Collection & Validation
  let email = parsedArgs.email || process.env.ADMIN_EMAIL || '';
  let name = parsedArgs.name || process.env.ADMIN_NAME || '';
  let password = process.env.ADMIN_PASSWORD || '';
  let confirmPassword = process.env.ADMIN_PASSWORD_CONFIRM || '';

  if (process.stdin.isTTY) {
    if (!email) {
      email = await promptLine('Enter Administrator Email Address: ');
    }
    if (!name) {
      name = (await promptLine('Enter Administrator Full Name [Platform Administrator]: ')) || 'Platform Administrator';
    }
    if (!password) {
      try {
        password = await promptMasked('Enter Administrator Password (min 8 chars, mixed case & digit): ');
        confirmPassword = await promptMasked('Confirm Administrator Password: ');
      } catch (abortErr: any) {
        return { success: false, message: abortErr.message };
      }
    }
  } else {
    // Non-interactive execution:
    // If password is provided via environment, require ADMIN_PASSWORD_CONFIRM to match
    if (password && !confirmPassword) {
      return {
        success: false,
        message:
          'In non-interactive environments, supplying ADMIN_PASSWORD requires ADMIN_PASSWORD_CONFIRM ' +
          'to prevent irreversible credential lockout from typos.',
      };
    }
  }

  const inputValidation = validateAdminInputs(
    email,
    name,
    password,
    confirmPassword || (process.stdin.isTTY ? confirmPassword : password)
  );

  if (!inputValidation.valid) {
    return {
      success: false,
      message: `Credential Validation Error: ${inputValidation.reason}`,
    };
  }

  const { normalizedEmail, normalizedName } = inputValidation;

  // 5. Database Interaction
  const prisma = customPrisma || new PrismaClient({ log: ['warn', 'error'] });

  try {
    // 5a. Check if account already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, role: true, email: true },
    });

    if (existingUser) {
      if (existingUser.role === 'ADMIN') {
        return {
          success: false,
          message:
            `Aborted: An account with email "${normalizedEmail}" already exists and is already an Administrator. ` +
            `Default provisioning creates new administrators only; it will not overwrite or reset existing credentials.`,
        };
      } else {
        return {
          success: false,
          message:
            `Aborted: An account with email "${normalizedEmail}" already exists with role "${existingUser.role}". ` +
            `Default provisioning creates new accounts only; accidental role promotion and account overwriting are disallowed.`,
        };
      }
    }

    // 5b. Dry run check
    if (parsedArgs.dryRun) {
      console.log('\n[DRY RUN] All validation checks passed successfully:');
      console.log('  - Target database connection string parsed and verified.');
      console.log('  - Authorization secret verified.');
      console.log('  - Administrator credential formats and password policy verified.');
      console.log(`  - Database read query confirmed email "${normalizedEmail}" is currently unregistered.`);
      console.log('[DRY RUN] Zero database writes were performed (strictly read-only).\n');
      console.log('[DRY RUN LIMITATIONS ADVISORY]');
      console.log('A passing dry run verifies authorization and pre-conditions at query time.');
      console.log('It does NOT guarantee subsequent provisioning will succeed. Subsequent runs may fail due to:');
      console.log('  1. Network interruptions or connection pool exhaustion.');
      console.log('  2. Insufficient database write/insert privileges.');
      console.log('  3. Database triggers, locks, or schema constraint violations.');
      console.log('  4. Race conditions from concurrent registration with the same email.');

      return {
        success: true,
        isDryRun: true,
      };
    }

    // 5c. Secure Hashing & Safe Insertion
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const createdAdmin = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
        role: 'ADMIN',
        tokenVersion: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    console.log('\n===============================================================');
    console.log('✅ Administrator account successfully provisioned!');
    console.log('===============================================================');
    console.log(`  Name:      ${createdAdmin.name}`);
    console.log(`  Email:     ${createdAdmin.email}`);
    console.log(`  Role:      ${createdAdmin.role}`);
    console.log(`  Created:   ${createdAdmin.createdAt.toISOString()}`);
    console.log('\nThe account is ready for sign in at /login.');

    return {
      success: true,
      createdUser: createdAdmin,
    };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return {
        success: false,
        message: `Conflict: An account with email "${normalizedEmail}" was created concurrently (unique constraint violation).`,
      };
    }
    const safeError = sanitizeErrorMessage(error?.message || String(error));
    return {
      success: false,
      message: `Database error during provisioning: ${safeError}`,
    };
  } finally {
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  }
}

export function printHelp(): void {
  console.log(`
RentGoer Admin Provisioning CLI Help
====================================

Usage:
  # Local Development (TypeScript via tsx)
  npm run admin:provision -- [options]

  # Production Runtime (Compiled JavaScript via Node.js)
  node dist/scripts/provision-admin.js [options]

Options:
  --help, -h            Show this help documentation.
  --dry-run             Validate credentials, authorization, and database target without writing to the database.
  --confirm-target      Confirm targeting the configured database in automated/non-interactive environments.
  --confirm-remote      Allow provisioning on remote/cloud databases (requires ALLOW_REMOTE_PROVISION=true).
  --email=<email>       Administrator email address.
  --name=<name>         Administrator full name (defaults to "Platform Administrator").

Security Rules:
  * Passing secrets or passwords via CLI arguments (--secret, --password) is strictly prohibited.
  * In interactive mode, secrets and passwords are collected via masked prompts.
  * In non-interactive mode, secrets and passwords must be supplied via environment variables.

Environment Variables:
  DATABASE_URL                  Required PostgreSQL connection string.
  ADMIN_PROVISION_SECRET        Required server authorization secret (min 16 chars).
  ADMIN_SECRET                  Operator authorization secret matching ADMIN_PROVISION_SECRET.
  ALLOW_REMOTE_PROVISION        Must be set to "true" to target non-localhost databases.
  ADMIN_EMAIL                   Optional email address.
  ADMIN_NAME                    Optional administrator name.
  ADMIN_PASSWORD                Optional administrator password (requires ADMIN_PASSWORD_CONFIRM if non-interactive).
  ADMIN_PASSWORD_CONFIRM        Password confirmation (must match ADMIN_PASSWORD).
`);
}

/**
 * Top-level CLI entry point with safe exit handler.
 */
async function main() {
  try {
    const result = await runProvisioning();
    if (!result.success) {
      if (result.message) {
        console.error(`\n❌ ${result.message}`);
      }
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error(`\n❌ Fatal Error: ${sanitizeErrorMessage(err?.message || String(err))}`);
    process.exitCode = 1;
  }
}

// Auto-run if executed directly as a script
if (require.main === module || (process.argv[1] && process.argv[1].includes('provision-admin'))) {
  main();
}
