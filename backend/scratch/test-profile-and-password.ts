import { api } from './test-helper';

async function run() {
  console.log('Testing Profile & Password APIs...');
  const email = `profile_test_${Date.now()}@example.com`;
  const initialPassword = 'InitialPassword123!';
  const newPassword = 'UpdatedPassword456!';

  // 1. Register test user
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Original Name',
      email,
      password: initialPassword,
      role: 'TENANT',
    }),
  });
  const regCookie = regRes.headers.get('set-cookie') || '';
  const regData = await regRes.json();
  if (!regRes.ok) throw new Error(`Register failed: ${JSON.stringify(regData)}`);
  console.log('✓ Register test user succeeded');

  // 2. Test GET /api/auth/me
  const meRes = await fetch('http://localhost:5000/api/auth/me', {
    headers: { Cookie: regCookie },
  });
  const meData = await meRes.json();
  if (!meRes.ok) throw new Error(`GET /me failed: ${JSON.stringify(meData)}`);
  if (!('phone' in meData.user)) throw new Error('Expected phone field in /me user');
  if (!('isVerified' in meData.user)) throw new Error('Expected isVerified field in /me user');
  console.log('✓ GET /auth/me returns phone and isVerified');

  // 3. Test PUT /api/auth/profile with invalid name
  const invalidNameRes = await fetch('http://localhost:5000/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: regCookie },
    body: JSON.stringify({ name: 'A' }),
  });
  if (invalidNameRes.status !== 400) throw new Error('Expected 400 for short name');
  console.log('✓ Validation rejects name < 2 chars');

  // 4. Test PUT /api/auth/profile with valid data & malicious field injection
  const updateRes = await fetch('http://localhost:5000/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: regCookie },
    body: JSON.stringify({
      name: 'Updated Name',
      phone: '+91 9876543210',
      role: 'ADMIN', // Should be ignored!
      isVerified: true, // Should be ignored!
      email: 'hacked@example.com', // Should be ignored!
    }),
  });
  const updateData = await updateRes.json();
  if (!updateRes.ok) throw new Error(`Update failed: ${JSON.stringify(updateData)}`);
  if (updateData.user.name !== 'Updated Name') throw new Error('Name was not updated');
  if (updateData.user.phone !== '+91 9876543210') throw new Error('Phone was not updated');
  if (updateData.user.role === 'ADMIN') throw new Error('SECURITY VIOLATION: Role was modified via profile endpoint!');
  if (updateData.user.isVerified === true) throw new Error('SECURITY VIOLATION: isVerified was modified via profile endpoint!');
  if (updateData.user.email === 'hacked@example.com') throw new Error('SECURITY VIOLATION: Email was modified via profile endpoint!');
  console.log('✓ Profile update succeeded and strictly protects role, isVerified, and email');

  // 5. Test PUT /api/auth/change-password with wrong current password
  const wrongCurrentRes = await fetch('http://localhost:5000/api/auth/change-password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: regCookie },
    body: JSON.stringify({
      currentPassword: 'WrongPassword!',
      newPassword,
      confirmPassword: newPassword,
    }),
  });
  if (wrongCurrentRes.status !== 400) throw new Error('Expected 400 for incorrect current password');
  console.log('✓ Password change rejects incorrect current password');

  // 6. Test PUT /api/auth/change-password with mismatched confirmation
  const mismatchRes = await fetch('http://localhost:5000/api/auth/change-password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: regCookie },
    body: JSON.stringify({
      currentPassword: initialPassword,
      newPassword,
      confirmPassword: 'DifferentPassword!',
    }),
  });
  if (mismatchRes.status !== 400) throw new Error('Expected 400 for mismatched passwords');
  console.log('✓ Password change rejects mismatched confirmation');

  // 7. Test PUT /api/auth/change-password with valid passwords
  const changeRes = await fetch('http://localhost:5000/api/auth/change-password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: regCookie },
    body: JSON.stringify({
      currentPassword: initialPassword,
      newPassword,
      confirmPassword: newPassword,
    }),
  });
  const changeData = await changeRes.json();
  if (!changeRes.ok) throw new Error(`Change password failed: ${JSON.stringify(changeData)}`);
  console.log('✓ Password change succeeded');

  // 8. Verify login with the new password
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: newPassword,
    }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login with new password failed: ${JSON.stringify(loginData)}`);
  if (loginData.user.name !== 'Updated Name') throw new Error('Login returned outdated name');
  console.log('✓ Login with new password succeeded and returned updated profile');

  console.log('\n🎉 ALL PROFILE & PASSWORD BACKEND TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
