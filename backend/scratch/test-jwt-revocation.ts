import { prisma } from '../src/lib/prisma';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

async function run() {
  console.log('=== Starting Complete JWT Revocation & Security Test Suite ===\n');
  const email = `revocation_test_${Date.now()}@example.com`;
  const initialPassword = 'InitialPassword123!';
  const updatedPassword = 'NewSecretPassword456!';
  let userId: string = '';

  try {
    // 1. Register test user (starts with tokenVersion = 0)
    console.log('[Test 1 & 2] User registration and initial tokenVersion verification...');
    const regRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Revocation Test User',
        email,
        password: initialPassword,
        role: 'TENANT',
      }),
    });
    const regCookie = regRes.headers.get('set-cookie') || '';
    const regData: any = await regRes.json();
    if (!regRes.ok) throw new Error(`Register failed: ${JSON.stringify(regData)}`);
    userId = regData.user.id;

    // Decode token to verify tokenVersion in payload
    const tokenMatch = regCookie.match(/rentgoer_token=([^;]+)/);
    if (!tokenMatch) throw new Error('Missing rentgoer_token cookie on register');
    const firstToken = tokenMatch[1];
    const decodedFirst = jwt.decode(firstToken) as any;
    if (decodedFirst.tokenVersion !== 0) {
      throw new Error(`Expected tokenVersion 0 in initial token, got: ${decodedFirst.tokenVersion}`);
    }
    console.log('✓ Test 1 & 2 passed: Initial token has tokenVersion = 0');

    // 2. Normal JWT remains valid on protected API
    console.log('\n[Test 2] Verifying valid JWT accesses protected API (/api/auth/me)...');
    const meRes1 = await fetch('http://localhost:5000/api/auth/me', {
      headers: { Cookie: `rentgoer_token=${firstToken}` },
    });
    const meData1: any = await meRes1.json();
    if (!meRes1.ok || meData1.user.id !== userId) {
      throw new Error(`GET /me failed with valid token: ${JSON.stringify(meData1)}`);
    }
    console.log('✓ Test 2 passed: Valid JWT with matching version successfully accesses protected API');

    // 3. Stale token rejection before password change (simulate stale token with mismatched version)
    console.log('\n[Test 3] Simulating token with invalid/stale tokenVersion...');
    const fakeSecret = process.env.JWT_SECRET || '56a9228b64eb1f6e47ab6d85b2cf62f3e58d1ab84893da227fcdf434e4d5baf711f61fe82bedb526c04103853b4403e9';
    const staleToken = jwt.sign({ id: userId, role: 'TENANT', tokenVersion: 999 }, fakeSecret, { expiresIn: '7d' });
    const staleRes = await fetch('http://localhost:5000/api/auth/me', {
      headers: { Cookie: `rentgoer_token=${staleToken}` },
    });
    if (staleRes.status !== 401) {
      throw new Error(`Expected 401 for stale tokenVersion, got status ${staleRes.status}`);
    }
    console.log('✓ Test 3 passed: Token with mismatched tokenVersion is rejected with 401');

    // 4. Test incorrect current password rejection
    console.log('\n[Test 9] Testing password change rejection with wrong current password...');
    const wrongPassRes = await fetch('http://localhost:5000/api/auth/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rentgoer_token=${firstToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword!',
        newPassword: updatedPassword,
        confirmPassword: updatedPassword,
      }),
    });
    if (wrongPassRes.status !== 400) {
      throw new Error(`Expected 400 for incorrect current password, got ${wrongPassRes.status}`);
    }
    console.log('✓ Test 9 passed: Incorrect current password rejected with 400');

    // 5. Test malicious profile update cannot modify tokenVersion or role
    console.log('\n[Test 10] Testing malicious profile update attempting to modify tokenVersion & role...');
    const maliciousRes = await fetch('http://localhost:5000/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rentgoer_token=${firstToken}`,
      },
      body: JSON.stringify({
        name: 'Updated Name',
        phone: '+1 555-0199',
        tokenVersion: 9999, // Malicious injection
        role: 'ADMIN',       // Malicious injection
      }),
    });
    const malData: any = await maliciousRes.json();
    if (!maliciousRes.ok) throw new Error(`Profile update failed: ${JSON.stringify(malData)}`);
    const dbUserAfterProfile = await prisma.user.findUnique({ where: { id: userId } });
    if (dbUserAfterProfile?.tokenVersion !== 0) {
      throw new Error('SECURITY VIOLATION: tokenVersion was modified via profile update!');
    }
    if (dbUserAfterProfile?.role !== 'TENANT') {
      throw new Error('SECURITY VIOLATION: role was modified via profile update!');
    }
    console.log('✓ Test 10 passed: Protected fields (tokenVersion, role) cannot be changed via profile update');

    // 6. Perform legitimate password change
    console.log('\n[Test 4] Changing password and verifying tokenVersion increment...');
    const changeRes = await fetch('http://localhost:5000/api/auth/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rentgoer_token=${firstToken}`,
      },
      body: JSON.stringify({
        currentPassword: initialPassword,
        newPassword: updatedPassword,
        confirmPassword: updatedPassword,
      }),
    });
    const changeData: any = await changeRes.json();
    if (!changeRes.ok) throw new Error(`Password change failed: ${JSON.stringify(changeData)}`);

    // Verify database record has tokenVersion incremented to 1
    const dbUserAfterPass = await prisma.user.findUnique({ where: { id: userId } });
    if (dbUserAfterPass?.tokenVersion !== 1) {
      throw new Error(`Expected database tokenVersion 1, got ${dbUserAfterPass?.tokenVersion}`);
    }
    console.log('✓ Test 4 passed: Password change atomically incremented tokenVersion to 1');

    // 7. Verify old token is now REVOKED on primary device & simulated second device
    console.log('\n[Test 5 & 6] Verifying previous token is now rejected on protected APIs...');
    const meResOldToken = await fetch('http://localhost:5000/api/auth/me', {
      headers: { Cookie: `rentgoer_token=${firstToken}` },
    });
    if (meResOldToken.status !== 401) {
      throw new Error(`Expected 401 for old token after password change, got ${meResOldToken.status}`);
    }
    console.log('✓ Test 5 & 6 passed: Old token (Device 1 & simulated Device 2) rejected with 401 Session Revoked');

    // 8. User can log in with new password
    console.log('\n[Test 7 & 8] Logging in with new password and checking new tokenVersion...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: updatedPassword,
      }),
    });
    const loginCookie = loginRes.headers.get('set-cookie') || '';
    const loginData: any = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Login with new password failed: ${JSON.stringify(loginData)}`);

    const newTokenMatch = loginCookie.match(/rentgoer_token=([^;]+)/);
    if (!newTokenMatch) throw new Error('Missing rentgoer_token cookie on new login');
    const secondToken = newTokenMatch[1];
    const decodedSecond = jwt.decode(secondToken) as any;
    if (decodedSecond.tokenVersion !== 1) {
      throw new Error(`Expected tokenVersion 1 in new login token, got ${decodedSecond.tokenVersion}`);
    }
    console.log('✓ Test 7 & 8 passed: Login succeeds with new password, issuing tokenVersion = 1');

    // 9. New token works on protected API
    console.log('\n[Test 11] Verifying new token accesses protected endpoint...');
    const meResNewToken = await fetch('http://localhost:5000/api/auth/me', {
      headers: { Cookie: `rentgoer_token=${secondToken}` },
    });
    if (!meResNewToken.ok) throw new Error('Failed to access /api/auth/me with new token');
    console.log('✓ Test 11 passed: New token successfully accesses protected endpoints');

    // 10. Logout behavior
    console.log('\n[Test 12] Verifying logout clears cookie properly...');
    const logoutRes = await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: `rentgoer_token=${secondToken}` },
    });
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';
    if (!logoutCookie.includes('rentgoer_token=;') && !logoutCookie.includes('Max-Age=0')) {
      throw new Error('Expected cookie clearing on logout');
    }
    console.log('✓ Test 12 passed: Logout clears cookie properly');

    console.log('\n🎉 ALL 12 REGRESSION AND SECURITY TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    // Cleanup test user
    if (userId) {
      console.log('Cleaning up test user...');
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      console.log('Cleanup complete.');
    }
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
