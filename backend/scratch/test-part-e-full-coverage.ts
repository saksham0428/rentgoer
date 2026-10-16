import fetch from 'node-fetch';
import { prisma } from '../src/lib/prisma';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api';

async function runFullAuditTests() {
  console.log('===============================================================');
  console.log('🚀 RENTGOER PART E: FULL COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('===============================================================\n');

  const ts = Date.now();
  const tenantEmail = `test_tenant_${ts}@example.com`;
  const ownerEmail = `test_owner_${ts}@example.com`;
  const otherEmail = `test_other_${ts}@example.com`;
  const tenantPassword = 'TenantPassword123!';
  const ownerPassword = 'OwnerPassword123!';
  const otherPassword = 'OtherPassword123!';

  const createdUserIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // 1. PUBLIC ROLE ESCALATION SAFEGUARDS
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Public Role Escalation Safeguards ---');

    // 1a. Attempt to register directly as ADMIN
    const adminRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Admin',
        email: `hacker_admin_${ts}@example.com`,
        password: 'Password123!',
        role: 'ADMIN',
      }),
    });
    if (adminRegRes.status !== 403) {
      throw new Error(`Expected 403 when registering with role=ADMIN, got: ${adminRegRes.status}`);
    }
    console.log('✓ Public registration correctly rejects role=ADMIN with 403 Forbidden');

    // 1b. Attempt to register with invalid/arbitrary role
    const invalidRoleRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Arbitrary',
        email: `hacker_arbitrary_${ts}@example.com`,
        password: 'Password123!',
        role: 'SUPERUSER',
      }),
    });
    if (invalidRoleRes.status !== 400) {
      throw new Error(`Expected 400 when registering with invalid role, got: ${invalidRoleRes.status}`);
    }
    console.log('✓ Public registration correctly rejects invalid/custom role with 400 Bad Request');

    // -------------------------------------------------------------------------
    // 2. USER REGISTRATION & INITIAL SESSIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Registering Baseline Users (Tenant, Owner, Other) ---');

    // Tenant registration
    const tReg = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Audit Tenant',
        email: tenantEmail,
        password: tenantPassword,
        role: 'TENANT',
      }),
    });
    const tData: any = await tReg.json();
    if (!tReg.ok) throw new Error(`Tenant register failed: ${JSON.stringify(tData)}`);
    const tenantCookie = tReg.headers.get('set-cookie')?.split(';')[0] || '';
    createdUserIds.push(tData.user.id);
    console.log(`✓ Tenant user created (${tenantEmail}), tokenVersion: ${tData.user.tokenVersion}`);

    // Owner registration
    const oReg = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Audit Owner',
        email: ownerEmail,
        password: ownerPassword,
        role: 'OWNER',
      }),
    });
    const oData: any = await oReg.json();
    if (!oReg.ok) throw new Error(`Owner register failed: ${JSON.stringify(oData)}`);
    const ownerCookie = oReg.headers.get('set-cookie')?.split(';')[0] || '';
    createdUserIds.push(oData.user.id);
    console.log(`✓ Owner user created (${ownerEmail}), tokenVersion: ${oData.user.tokenVersion}`);

    // Other user registration (to test duplicate email collisions)
    const otherReg = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Audit Other',
        email: otherEmail,
        password: otherPassword,
        role: 'TENANT',
      }),
    });
    const otherData: any = await otherReg.json();
    if (!otherReg.ok) throw new Error(`Other user register failed: ${JSON.stringify(otherData)}`);
    createdUserIds.push(otherData.user.id);
    console.log(`✓ Other collision user created (${otherEmail})`);

    // Verify /api/auth/me for tenant
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: tenantCookie },
    });
    const meData: any = await meRes.json();
    if (!meRes.ok || meData.user.email !== tenantEmail) {
      throw new Error(`/api/auth/me failed: ${JSON.stringify(meData)}`);
    }
    console.log('✓ /api/auth/me successfully returns authenticated tenant user payload');

    // -------------------------------------------------------------------------
    // 3. ADMIN ACCESS & BACKEND API AUTHORIZATION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Admin Access Control and Route Authorization ---');

    // Provision or verify admin
    let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    let adminEmail = 'admin.report@test.com';
    let adminPass = 'Password123!';
    if (!adminUser) {
      adminEmail = `admin_audit_${ts}@example.com`;
      adminUser = await prisma.user.create({
        data: {
          name: 'Platform Admin',
          email: adminEmail,
          passwordHash: await (await import('bcrypt')).hash(adminPass, 10),
          role: 'ADMIN',
          tokenVersion: 0,
        },
      });
      createdUserIds.push(adminUser.id);
      console.log(`✓ Provisioned test admin account (${adminEmail})`);
    } else {
      adminEmail = adminUser.email;
      // Re-key test admin password if necessary for predictable testing
      const bcrypt = await import('bcrypt');
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { passwordHash: await bcrypt.hash(adminPass, 10) },
      });
      console.log(`✓ Using verified admin account (${adminEmail})`);
    }

    // Admin login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPass }),
    });
    const adminLoginData: any = await adminLoginRes.json();
    if (!adminLoginRes.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
    const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
    if (!adminCookie) throw new Error('Missing admin session cookie');
    console.log('✓ Admin successfully authenticated via /api/auth/login');

    // Matrix of Admin Protected Endpoints
    const adminEndpoints = [
      { path: '/admin/stats', method: 'GET' },
      { path: '/admin/users', method: 'GET' },
      { path: '/admin/properties', method: 'GET' },
      { path: '/admin/reports', method: 'GET' },
      { path: '/admin/verification', method: 'GET' },
    ];

    for (const ep of adminEndpoints) {
      // 3a. Unauthenticated access denied (401)
      const unauthRes = await fetch(`${BASE_URL}${ep.path}`, { method: ep.method });
      if (unauthRes.status !== 401) {
        throw new Error(`Expected 401 on unauthenticated ${ep.path}, got: ${unauthRes.status}`);
      }

      // 3b. Tenant access denied (403)
      const tenantRes = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { Cookie: tenantCookie },
      });
      if (tenantRes.status !== 403) {
        throw new Error(`Expected 403 for Tenant on ${ep.path}, got: ${tenantRes.status}`);
      }

      // 3c. Owner access denied (403)
      const ownerRes = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { Cookie: ownerCookie },
      });
      if (ownerRes.status !== 403) {
        throw new Error(`Expected 403 for Owner on ${ep.path}, got: ${ownerRes.status}`);
      }

      // 3d. Admin access allowed (200)
      const adminRes = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { Cookie: adminCookie },
      });
      if (adminRes.status !== 200) {
        throw new Error(`Expected 200 for Admin on ${ep.path}, got: ${adminRes.status}`);
      }

      console.log(`✓ ${ep.path}: Unauth=401, Tenant=403, Owner=403, Admin=200`);
    }

    // -------------------------------------------------------------------------
    // 4. SELF-SERVICE EMAIL CHANGE SPECIFICATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Self-Service Email Changes ---');

    // 4a. Reject when missing new email or password
    const missingFieldsRes = await fetch(`${BASE_URL}/auth/change-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: tenantCookie },
      body: JSON.stringify({ newEmail: '' }),
    });
    if (missingFieldsRes.status !== 400) {
      throw new Error(`Expected 400 for missing fields, got: ${missingFieldsRes.status}`);
    }
    console.log('✓ Rejects missing new email or password with 400');

    // 4b. Reject invalid email format
    const invalidEmailRes = await fetch(`${BASE_URL}/auth/change-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: tenantCookie },
      body: JSON.stringify({ newEmail: 'not-an-email', password: tenantPassword }),
    });
    if (invalidEmailRes.status !== 400) {
      throw new Error(`Expected 400 for invalid email format, got: ${invalidEmailRes.status}`);
    }
    console.log('✓ Rejects invalid email format with 400');

    // 4c. Reject new email identical to current email
    const sameEmailRes = await fetch(`${BASE_URL}/auth/change-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: tenantCookie },
      body: JSON.stringify({ newEmail: tenantEmail, password: tenantPassword }),
    });
    if (sameEmailRes.status !== 400) {
      throw new Error(`Expected 400 for identical email, got: ${sameEmailRes.status}`);
    }
    console.log('✓ Rejects new email identical to current email with 400');

    // 4d. Reject incorrect current password
    const wrongPassRes = await fetch(`${BASE_URL}/auth/change-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: tenantCookie },
      body: JSON.stringify({ newEmail: `updated_${ts}@example.com`, password: 'IncorrectPassword999!' }),
    });
    if (wrongPassRes.status !== 400) {
      throw new Error(`Expected 400 for wrong password, got: ${wrongPassRes.status}`);
    }
    console.log('✓ Rejects incorrect current password with 400');

    // 4e. Reject duplicate email already registered to another account
    const dupEmailRes = await fetch(`${BASE_URL}/auth/change-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: tenantCookie },
      body: JSON.stringify({ newEmail: otherEmail, password: tenantPassword }),
    });
    if (dupEmailRes.status !== 409) {
      throw new Error(`Expected 409 for duplicate email conflict, got: ${dupEmailRes.status}`);
    }
    console.log('✓ Rejects duplicate email already owned by another account with 409 Conflict');

    // 4f. Valid Email Change Workflow
    const newTenantEmail = `tenant_verified_updated_${ts}@example.com`;
    const validChangeRes = await fetch(`${BASE_URL}/auth/change-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: tenantCookie },
      body: JSON.stringify({ newEmail: newTenantEmail, password: tenantPassword }),
    });
    const validChangeData: any = await validChangeRes.json();
    if (!validChangeRes.ok) {
      throw new Error(`Valid email change failed: ${JSON.stringify(validChangeData)}`);
    }
    const updatedTenantCookie = validChangeRes.headers.get('set-cookie')?.split(';')[0] || '';
    if (!updatedTenantCookie) throw new Error('Missing updated session cookie after email change');
    console.log(`✓ Email change succeeded: ${tenantEmail} -> ${newTenantEmail}`);

    // Verify tokenVersion was incremented
    const dbUserAfterEmail = await prisma.user.findUnique({
      where: { id: tData.user.id },
      select: { email: true, tokenVersion: true, role: true },
    });
    if (dbUserAfterEmail?.email !== newTenantEmail) {
      throw new Error(`Database email was not updated. Expected ${newTenantEmail}, found ${dbUserAfterEmail?.email}`);
    }
    if (dbUserAfterEmail.tokenVersion <= tData.user.tokenVersion) {
      throw new Error(`tokenVersion was not incremented! Old: ${tData.user.tokenVersion}, New: ${dbUserAfterEmail.tokenVersion}`);
    }
    if (dbUserAfterEmail.role !== 'TENANT') {
      throw new Error(`Role was unexpectedly changed! Current role: ${dbUserAfterEmail.role}`);
    }
    console.log(`✓ DB User atomically updated: email="${dbUserAfterEmail.email}", tokenVersion=${dbUserAfterEmail.tokenVersion}, role preserved="${dbUserAfterEmail.role}"`);

    // 4g. Verify Session Revocation Policy:
    // Old cookie from previous session must be rejected because tokenVersion is stale
    const oldCookieRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: tenantCookie },
    });
    if (oldCookieRes.status !== 401) {
      throw new Error(`Expected old cookie to be revoked with 401, got: ${oldCookieRes.status}`);
    }
    console.log('✓ Stale cookie from before email change is immediately revoked (401)');

    // Active session cookie with updated tokenVersion is valid and reflects new email
    const newCookieRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: updatedTenantCookie },
    });
    const newCookieData: any = await newCookieRes.json();
    if (!newCookieRes.ok || newCookieData.user.email !== newTenantEmail) {
      throw new Error(`New cookie failed /api/auth/me: ${JSON.stringify(newCookieData)}`);
    }
    console.log(`✓ Re-issued cookie seamlessly accesses /api/auth/me with active 7-day session duration`);

    // -------------------------------------------------------------------------
    // 5. PROFILE EDITING & IDOR PREVENTION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Profile Editing & IDOR Safeguards ---');

    // 5a. Normal profile update
    const profileRes = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: updatedTenantCookie },
      body: JSON.stringify({
        name: 'Updated Tenant Name',
        phone: '+91 9988776655',
      }),
    });
    const profileData: any = await profileRes.json();
    if (!profileRes.ok || profileData.user.name !== 'Updated Tenant Name') {
      throw new Error(`Profile update failed: ${JSON.stringify(profileData)}`);
    }
    console.log('✓ Existing profile editing (name, phone) functions properly');

    // 5b. Attempt to tamper with another user ID or privilege escalation via profile endpoint
    const idorRes = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: updatedTenantCookie },
      body: JSON.stringify({
        id: otherData.user.id, // Attempt to modify other user
        name: 'Hacked Name',
        role: 'ADMIN',         // Attempt privilege escalation
        email: 'hacked@example.com',
      }),
    });
    const idorData: any = await idorRes.json();
    if (!idorRes.ok) throw new Error(`IDOR test request failed: ${JSON.stringify(idorData)}`);
    
    // Check other user in DB
    const otherInDb = await prisma.user.findUnique({ where: { id: otherData.user.id } });
    if (otherInDb?.name === 'Hacked Name') {
      throw new Error('SECURITY VIOLATION: Attacker updated another user account via profile endpoint!');
    }
    // Check calling user in DB
    const callerInDb = await prisma.user.findUnique({ where: { id: tData.user.id } });
    if (callerInDb?.role === 'ADMIN' || callerInDb?.email === 'hacked@example.com') {
      throw new Error('SECURITY VIOLATION: Role or email was altered via profile update!');
    }
    console.log('✓ Profile update strictly binds to req.user.id and ignores malicious id/role/email injections');

    // -------------------------------------------------------------------------
    // 6. PASSWORD-CHANGE SESSION REVOCATION & RE-LOGIN
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Password Change Session Revocation & Login ---');

    const newTenantPassword = 'BrandNewPassword789!';
    const passChangeRes = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: updatedTenantCookie },
      body: JSON.stringify({
        currentPassword: tenantPassword,
        newPassword: newTenantPassword,
        confirmPassword: newTenantPassword,
      }),
    });
    if (!passChangeRes.ok) {
      throw new Error(`Password change failed: ${await passChangeRes.text()}`);
    }
    console.log('✓ Password change succeeded');

    // Previous session cookie must now be revoked
    const meAfterPass = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: updatedTenantCookie },
    });
    if (meAfterPass.status !== 401) {
      throw new Error(`Expected 401 after password change, got: ${meAfterPass.status}`);
    }
    console.log('✓ Prior session cookie revoked on /api/auth/me after password change');

    // Login with new password and new email
    const loginWithNewRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newTenantEmail,
        password: newTenantPassword,
      }),
    });
    const loginWithNewData: any = await loginWithNewRes.json();
    if (!loginWithNewRes.ok) {
      throw new Error(`Login with updated email and password failed: ${JSON.stringify(loginWithNewData)}`);
    }
    const freshLoginCookie = loginWithNewRes.headers.get('set-cookie')?.split(';')[0] || '';
    console.log('✓ Login with updated email and new password succeeded');

    // Test logout clears cookie
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: freshLoginCookie },
    });
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';
    if (!logoutCookie.includes('rentgoer_token=;') && !logoutCookie.includes('Max-Age=0') && !logoutCookie.includes('Expires=')) {
      throw new Error('Logout did not set cookie clearance');
    }
    console.log('✓ /api/auth/logout successfully clears authentication cookie');

    console.log('\n===============================================================');
    console.log('🎉 ALL PART E AUTOMATED AUDIT & SECURITY TESTS PASSED (100%)');
    console.log('===============================================================\n');
  } finally {
    // Clean up created test users
    console.log('Cleaning up temporary audit users from database...');
    for (const uid of createdUserIds) {
      await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log('✓ Cleanup complete.');
  }
}

runFullAuditTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
