import assert from 'assert';
import {
  sanitizeDatabaseUrl,
  validateTargetEnvironment,
  verifyAuthorizationSecret,
  validateAdminInputs,
  parseProvisioningArgs,
  sanitizeErrorMessage,
  runProvisioning,
} from '../src/scripts/provision-admin';

async function runHardenedProvisioningUnitTests() {
  console.log('===============================================================');
  console.log('🧪 HARDENED ADMIN PROVISIONING: OFFLINE UNIT TEST SUITE');
  console.log('   (100% Mocked & Pure - Zero Real Database Connections)');
  console.log('===============================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Database Target Classification & Credential Masking
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Database Target Classification & Credential Masking ---');

  // Strictly recognized local loopback hosts
  const localHosts = [
    'postgresql://user:pass@localhost:5432/rentgoer_dev',
    'postgresql://user:pass@127.0.0.1:5432/rentgoer_dev',
    'postgresql://user:pass@[::1]:5432/rentgoer_dev',
    'postgresql://user:pass@127.0.0.99:5432/rentgoer_dev',
  ];
  for (const url of localHosts) {
    const sanitized = sanitizeDatabaseUrl(url);
    assert.strictEqual(sanitized.isLocal, true, `Expected ${url} to be classified as local`);
    assert(!sanitized.sanitizedDisplay.includes('pass'), 'Password must never appear in sanitized output');
    assert(!sanitized.sanitizedDisplay.includes('user:'), 'User credentials must not appear in sanitized output');
  }
  console.log('✓ Strictly recognized loopback hosts classified as local');

  // Remote, cloud, mDNS, and container hosts MUST be classified as non-local/remote
  const remoteHosts = [
    'postgresql://postgres.myprojectref:SuperSecretPass123!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=pooler',
    'postgresql://admin:SecretPass@rentgoer-db.render.com:5432/rentgoer_prod',
    'postgresql://admin:SecretPass@postgres.railway.app:5432/railway',
    'postgresql://admin:SecretPass@my-nas.local:5432/dev', // .local mDNS must NOT be considered local
    'postgresql://admin:SecretPass@host.docker.internal:5432/dev', // docker internal host must NOT be considered local
    'postgresql://admin:SecretPass@192.168.1.50:5432/internal_db', // LAN IP must NOT be considered local
    'postgresql://admin:SecretPass@unknown-vps.example.com:5432/prod_db', // arbitrary VPS
  ];
  for (const url of remoteHosts) {
    const sanitized = sanitizeDatabaseUrl(url);
    assert.strictEqual(sanitized.isLocal, false, `Expected ${url} to be classified as remote`);
    assert(!sanitized.sanitizedDisplay.includes('SecretPass'), 'Password must never appear in sanitized output');
  }
  console.log('✓ All non-loopback, mDNS (.local), Docker, and cloud hosts classified as remote');

  // Supabase project ref extraction and target fingerprint verification
  const rawSupabaseUrl = 'postgresql://postgres.proj123ref:SuperSecretPass123!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require';
  const sanitizedSupabase = sanitizeDatabaseUrl(rawSupabaseUrl);
  assert.strictEqual(sanitizedSupabase.projectRef, 'proj123ref', 'Expected projectRef extraction');
  assert.strictEqual(typeof sanitizedSupabase.targetFingerprint, 'string');
  assert.strictEqual(sanitizedSupabase.targetFingerprint.length, 16);
  assert(sanitizedSupabase.sanitizedDisplay.includes('Target Fingerprint (SHA-256):'));
  assert(sanitizedSupabase.sanitizedDisplay.includes('Project Ref: proj123ref'));
  console.log('✓ Project reference extracted safely and non-reversible target fingerprint computed');

  // Missing or malformed URLs
  assert.throws(() => sanitizeDatabaseUrl(''), /DATABASE_URL is not configured/);
  assert.throws(() => sanitizeDatabaseUrl(undefined), /DATABASE_URL is not configured/);
  assert.throws(() => sanitizeDatabaseUrl('not-a-valid-database-url'), /malformed/);
  console.log('✓ Missing and malformed database URLs rejected safely');

  // Error message sanitization
  const leakedError = 'Connection failed at postgresql://postgres:SuperSecretPassword123!@aws-0.pooler.supabase.com:6543/postgres?password=secretToken';
  const cleanError = sanitizeErrorMessage(leakedError);
  assert(!cleanError.includes('SuperSecretPassword123!'), 'Passwords must be redacted from error strings');
  assert(cleanError.includes('[REDACTED_CREDENTIALS]'));
  console.log('✓ Error message sanitization strips credentials from exception strings');

  // ---------------------------------------------------------------------------
  // 2. Remote Confirmation & Target Protection (Dual-Lock)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Target Environment Safeguards (Dual-Lock & Confirmation) ---');

  const remoteTarget = sanitizeDatabaseUrl('postgresql://admin:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres');
  const localTarget = sanitizeDatabaseUrl('postgresql://postgres:pass@localhost:5432/rentgoer_dev');

  // Case A: Remote without ALLOW_REMOTE_PROVISION and without --confirm-remote
  delete process.env.ALLOW_REMOTE_PROVISION;
  const remoteBlockedNeither = validateTargetEnvironment(remoteTarget, { allowRemote: false, confirmTarget: true });
  assert.strictEqual(remoteBlockedNeither.allowed, false);
  assert(remoteBlockedNeither.reason?.includes('ALLOW_REMOTE_PROVISION=true'));
  assert(remoteBlockedNeither.reason?.includes('--confirm-remote'));
  console.log('✓ Remote execution blocked when neither env nor flag is provided');

  // Case B: Remote with ALLOW_REMOTE_PROVISION=true but WITHOUT --confirm-remote
  process.env.ALLOW_REMOTE_PROVISION = 'true';
  const remoteBlockedNoFlag = validateTargetEnvironment(remoteTarget, { allowRemote: false, confirmTarget: true });
  assert.strictEqual(remoteBlockedNoFlag.allowed, false);
  assert(remoteBlockedNoFlag.reason?.includes('--confirm-remote'));
  console.log('✓ Remote execution blocked when ALLOW_REMOTE_PROVISION=true is set but --confirm-remote is missing');

  // Case C: Remote without ALLOW_REMOTE_PROVISION=true but WITH --confirm-remote
  delete process.env.ALLOW_REMOTE_PROVISION;
  const remoteBlockedNoEnv = validateTargetEnvironment(remoteTarget, { allowRemote: true, confirmTarget: true });
  assert.strictEqual(remoteBlockedNoEnv.allowed, false);
  assert(remoteBlockedNoEnv.reason?.includes('ALLOW_REMOTE_PROVISION=true'));
  console.log('✓ Remote execution blocked when --confirm-remote is supplied but ALLOW_REMOTE_PROVISION=true is missing');

  // Case D: Remote with BOTH ALLOW_REMOTE_PROVISION=true AND --confirm-remote, but WITHOUT confirmTarget
  process.env.ALLOW_REMOTE_PROVISION = 'true';
  const remoteBlockedNoTargetConfirm = validateTargetEnvironment(remoteTarget, { allowRemote: true, confirmTarget: false });
  assert.strictEqual(remoteBlockedNoTargetConfirm.allowed, false);
  assert(remoteBlockedNoTargetConfirm.reason?.includes('Explicit confirmation of the target database'));
  console.log('✓ Remote execution blocked without explicit target confirmation');

  // Case E: Remote with BOTH ALLOW_REMOTE_PROVISION=true AND --confirm-remote AND confirmTarget
  const remoteAllowed = validateTargetEnvironment(remoteTarget, { allowRemote: true, confirmTarget: true });
  assert.strictEqual(remoteAllowed.allowed, true);
  console.log('✓ Remote execution permitted ONLY when BOTH dual-locks and target confirmation are satisfied');

  // Case F: Local target requires explicit confirmation
  const localBlocked = validateTargetEnvironment(localTarget, { confirmTarget: false });
  assert.strictEqual(localBlocked.allowed, false);
  const localAllowed = validateTargetEnvironment(localTarget, { confirmTarget: true });
  assert.strictEqual(localAllowed.allowed, true);
  console.log('✓ Local execution strictly requires target confirmation');

  // Clean up env
  delete process.env.ALLOW_REMOTE_PROVISION;

  // ---------------------------------------------------------------------------
  // 3. Authorization Secret Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Authorization Secret Verification ---');

  // Missing or weak server secret in environment
  const missingConfig = verifyAuthorizationSecret('any-secret', '');
  assert.strictEqual(missingConfig.authorized, false);
  assert(missingConfig.reason?.includes('ADMIN_PROVISION_SECRET is not configured'));

  const weakConfig = verifyAuthorizationSecret('any-secret', 'short_secret');
  assert.strictEqual(weakConfig.authorized, false);
  assert(weakConfig.reason?.includes('too weak'));
  console.log('✓ Missing and short (<16 chars) ADMIN_PROVISION_SECRET rejected');

  // Missing provided secret
  const validExpectedSecret = 'SuperSecureLongAdminSecretKey2026!';
  const missingProvided = verifyAuthorizationSecret('', validExpectedSecret);
  assert.strictEqual(missingProvided.authorized, false);
  assert(missingProvided.reason?.includes('Missing provisioning authorization secret'));
  console.log('✓ Missing provided secret rejected');

  // Mismatched secret
  const mismatch = verifyAuthorizationSecret('WrongSecretToken12345', validExpectedSecret);
  assert.strictEqual(mismatch.authorized, false);
  assert(mismatch.reason?.includes('does not match'));
  console.log('✓ Mismatched secret rejected via timing-safe comparison');

  // Matching secret
  const matched = verifyAuthorizationSecret(validExpectedSecret, validExpectedSecret);
  assert.strictEqual(matched.authorized, true);
  console.log('✓ Valid matching authorization secret authorized');

  // ---------------------------------------------------------------------------
  // 4. CLI Argument Parsing & Rejection of Dangerous Flags
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing CLI Argument Parsing & Credential Flag Rejection ---');

  // Passing --secret or --password via CLI arguments must throw a security violation
  assert.throws(
    () => parseProvisioningArgs(['--secret=mysecret12345']),
    (err: any) => err.message.includes('Security Violation') && !err.message.includes('mysecret12345')
  );
  assert.throws(
    () => parseProvisioningArgs(['-s']),
    (err: any) => err.message.includes('Security Violation')
  );
  assert.throws(
    () => parseProvisioningArgs(['--password=MyPassword123!']),
    (err: any) => err.message.includes('Security Violation') && !err.message.includes('MyPassword123!')
  );
  assert.throws(
    () => parseProvisioningArgs(['-p']),
    (err: any) => err.message.includes('Security Violation')
  );
  console.log('✓ Dangerous --secret, --password, -s, -p flags rejected without echoing credentials');

  // Unrecognized arguments rejected
  assert.throws(() => parseProvisioningArgs(['--invalid-flag']), /Unrecognized command-line argument/);

  // Safe valid arguments parsed properly
  const parsed = parseProvisioningArgs([
    '--dry-run',
    '--confirm-target',
    '--confirm-remote',
    '--email=admin@rentgoer.com',
    '--name=Test Administrator',
  ]);
  assert.strictEqual(parsed.dryRun, true);
  assert.strictEqual(parsed.confirmTarget, true);
  assert.strictEqual(parsed.confirmRemote, true);
  assert.strictEqual(parsed.email, 'admin@rentgoer.com');
  assert.strictEqual(parsed.name, 'Test Administrator');
  console.log('✓ Safe valid arguments parsed accurately');

  // ---------------------------------------------------------------------------
  // 5. Credential & Password Complexity Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Credential & Password Complexity Validation ---');

  // Email format checks
  assert.strictEqual(validateAdminInputs('invalid-email', 'Admin', 'StrongP@ss1').valid, false);
  assert.strictEqual(validateAdminInputs('', 'Admin', 'StrongP@ss1').valid, false);

  // Name length checks
  assert.strictEqual(validateAdminInputs('admin@example.com', 'A', 'StrongP@ss1').valid, false);
  assert.strictEqual(validateAdminInputs('admin@example.com', 'a'.repeat(65), 'StrongP@ss1').valid, false);

  // Password complexity checks
  assert.strictEqual(validateAdminInputs('admin@example.com', 'Admin User', 'short1').valid, false); // < 8
  assert.strictEqual(validateAdminInputs('admin@example.com', 'Admin User', 'alllowercase1').valid, false); // No uppercase
  assert.strictEqual(validateAdminInputs('admin@example.com', 'Admin User', 'ALLUPPERCASE1').valid, false); // No lowercase
  assert.strictEqual(validateAdminInputs('admin@example.com', 'Admin User', 'NoDigitsPassword').valid, false); // No digit

  // Password confirmation check
  assert.strictEqual(
    validateAdminInputs('admin@example.com', 'Admin User', 'StrongP@ss1', 'DifferentP@ss1').valid,
    false,
    'Mismatched password confirmation must be rejected'
  );

  // Valid credentials normalized
  const validInputs = validateAdminInputs(
    '  Admin.Root@Example.COM  ',
    '  Platform Admin  ',
    'SecurePassword2026!',
    'SecurePassword2026!'
  );
  assert.strictEqual(validInputs.valid, true);
  assert.strictEqual(validInputs.normalizedEmail, 'admin.root@example.com');
  assert.strictEqual(validInputs.normalizedName, 'Platform Admin');
  console.log('✓ Credential validation and password confirmation enforced consistently');

  // ---------------------------------------------------------------------------
  // 6. Mock Prisma: Existing Account Abort (Zero Mutation Safety)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Existing Account Abort (Mock Prisma) ---');

  process.env.DATABASE_URL = 'postgresql://postgres:pass@localhost:5432/rentgoer_dev';
  process.env.ADMIN_PROVISION_SECRET = 'SuperSecureLongAdminSecretKey2026!';
  process.env.ADMIN_SECRET = 'SuperSecureLongAdminSecretKey2026!';
  process.env.ADMIN_EMAIL = 'existing.admin@example.com';
  process.env.ADMIN_NAME = 'Existing Admin';
  process.env.ADMIN_PASSWORD = 'SecureAdminPass1!';
  process.env.ADMIN_PASSWORD_CONFIRM = 'SecureAdminPass1!';

  let disconnectCalled = 0;
  let createCalled = 0;

  // Mock when user already exists as ADMIN
  const mockPrismaExistingAdmin = {
    user: {
      findUnique: async () => ({ id: 'usr-admin-1', email: 'existing.admin@example.com', role: 'ADMIN' }),
      create: async () => {
        createCalled++;
        throw new Error('user.create must not be called when account exists!');
      },
    },
    $disconnect: async () => {
      disconnectCalled++;
    },
  };

  const existingAdminResult = await runProvisioning(mockPrismaExistingAdmin as any, ['--confirm-target']);
  assert.strictEqual(existingAdminResult.success, false);
  assert(existingAdminResult.message?.includes('already an Administrator'));
  assert.strictEqual(createCalled, 0, 'Must never call create when account already exists');
  assert.strictEqual(disconnectCalled, 1, 'Must disconnect Prisma on abort');
  console.log('✓ Existing ADMIN account detected and aborted; zero database writes attempted');

  // Mock when user already exists as TENANT (prevent role promotion)
  disconnectCalled = 0;
  createCalled = 0;
  const mockPrismaExistingTenant = {
    user: {
      findUnique: async () => ({ id: 'usr-tenant-1', email: 'existing.admin@example.com', role: 'TENANT' }),
      create: async () => {
        createCalled++;
        throw new Error('user.create must not be called when account exists!');
      },
    },
    $disconnect: async () => {
      disconnectCalled++;
    },
  };

  const existingTenantResult = await runProvisioning(mockPrismaExistingTenant as any, ['--confirm-target']);
  assert.strictEqual(existingTenantResult.success, false);
  assert(existingTenantResult.message?.includes('accidental role promotion'));
  assert.strictEqual(createCalled, 0);
  assert.strictEqual(disconnectCalled, 1);
  console.log('✓ Existing non-admin account detected; accidental promotion rejected without mutation');

  // ---------------------------------------------------------------------------
  // 7. Mock Prisma: Dry-Run Safety (Read-Only Guarantee)
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Dry-Run Safety (Mock Prisma) ---');

  disconnectCalled = 0;
  createCalled = 0;
  let findUniqueCalled = 0;

  const mockPrismaDryRun = {
    user: {
      findUnique: async () => {
        findUniqueCalled++;
        return null; // Email is unregistered
      },
      create: async () => {
        createCalled++;
        throw new Error('user.create must NEVER be called during --dry-run!');
      },
    },
    $disconnect: async () => {
      disconnectCalled++;
    },
  };

  const dryRunResult = await runProvisioning(mockPrismaDryRun as any, ['--dry-run', '--confirm-target']);
  assert.strictEqual(dryRunResult.success, true);
  assert.strictEqual(dryRunResult.isDryRun, true);
  assert.strictEqual(findUniqueCalled, 1, 'findUnique must be called to check email availability');
  assert.strictEqual(createCalled, 0, 'user.create must NEVER be called in dry run');
  assert.strictEqual(disconnectCalled, 1, 'Prisma must disconnect after dry run');
  console.log('✓ Dry run performs read-only checks without write operations; disconnects cleanly');

  // ---------------------------------------------------------------------------
  // 8. Mock Prisma: Concurrent Duplicate Account Creation (P2002)
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Testing Concurrent Duplicate Handling (P2002) ---');

  disconnectCalled = 0;
  const mockPrismaRaceCondition = {
    user: {
      findUnique: async () => null, // First check passes
      create: async () => {
        const p2002Err: any = new Error('Unique constraint failed on the constraint: User_email_key');
        p2002Err.code = 'P2002';
        throw p2002Err;
      },
    },
    $disconnect: async () => {
      disconnectCalled++;
    },
  };

  const raceResult = await runProvisioning(mockPrismaRaceCondition as any, ['--confirm-target']);
  assert.strictEqual(raceResult.success, false);
  assert(raceResult.message?.includes('created concurrently'));
  assert.strictEqual(disconnectCalled, 1, 'Prisma must disconnect after constraint error');
  console.log('✓ Concurrent race condition (P2002) caught and handled cleanly');

  // ---------------------------------------------------------------------------
  // 9. Mock Prisma: Normal Provisioning Success & Disconnect
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Testing Provisioning Success & Disconnect Cleanup ---');

  disconnectCalled = 0;
  let createdPayload: any = null;

  const mockPrismaSuccess = {
    user: {
      findUnique: async () => null,
      create: async (args: any) => {
        createdPayload = args.data;
        return {
          id: 'usr-new-admin-123',
          name: args.data.name,
          email: args.data.email,
          role: args.data.role,
          createdAt: new Date(),
        };
      },
    },
    $disconnect: async () => {
      disconnectCalled++;
    },
  };

  const successResult = await runProvisioning(mockPrismaSuccess as any, ['--confirm-target']);
  assert.strictEqual(successResult.success, true);
  assert.strictEqual(successResult.createdUser?.role, 'ADMIN');
  assert.strictEqual(createdPayload.role, 'ADMIN');
  assert.strictEqual(createdPayload.tokenVersion, 0);
  assert(createdPayload.passwordHash.startsWith('$2'), 'Password hash must be valid bcrypt');
  assert.strictEqual(disconnectCalled, 1, 'Prisma must disconnect on successful completion');
  console.log('✓ Administrator account provisioned with role=ADMIN, tokenVersion=0, and bcrypt hash');

  // Cleanup environment variables
  delete process.env.ADMIN_PROVISION_SECRET;
  delete process.env.ADMIN_SECRET;
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_NAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD_CONFIRM;

  console.log('\n===============================================================');
  console.log('🎉 ALL PROVISIONING OFFLINE SAFETY TESTS PASSED (100%)');
  console.log('===============================================================\n');
}

runHardenedProvisioningUnitTests().catch((err) => {
  console.error('❌ Offline unit test failure:', err);
  process.exit(1);
});
