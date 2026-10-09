

const baseUrl = 'http://localhost:5000/api';
let cookie = '';

async function test() {
  console.log('Testing /api/health...');
  const healthRes = await fetch(`${baseUrl}/health`);
  console.log(await healthRes.json());

  console.log('\nTesting duplicate email / invalid registration...');
  const regFail1 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Admin', email: 'admin@test.com', password: 'Password123!', role: 'ADMIN' })
  });
  console.log('ADMIN reg expected fail:', await regFail1.json());

  const regFail2 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'invalid-email', password: 'Password123!', role: 'TENANT' })
  });
  console.log('Invalid email expected fail:', await regFail2.json());

  const regFail3 = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'test@test.com', password: 'short', role: 'TENANT' })
  });
  console.log('Weak password expected fail:', await regFail3.json());

  console.log('\nTesting TENANT registration...');
  const regTenant = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tenant User', email: `tenant${Date.now()}@test.com`, password: 'Password123!', role: 'TENANT' })
  });
  
  if (regTenant.ok) {
    const rawCookie = regTenant.headers.get('set-cookie');
    if (rawCookie) cookie = rawCookie;
    console.log('TENANT reg success:', await regTenant.json());
  }

  console.log('\nTesting /me endpoint (Authenticated)...');
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { 'Cookie': cookie }
  });
  console.log('Me result:', await meRes.json());

  console.log('\nTesting OWNER registration...');
  const emailOwner = `owner${Date.now()}@test.com`;
  const regOwner = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Owner User', email: emailOwner, password: 'Password123!', role: 'OWNER' })
  });
  console.log('OWNER reg success:', await regOwner.json());

  console.log('\nTesting Duplicate email fail...');
  const dupOwner = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Owner User', email: emailOwner, password: 'Password123!', role: 'OWNER' })
  });
  console.log('Duplicate reg fail:', await dupOwner.json());

  console.log('\nTesting LOGIN...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailOwner, password: 'Password123!' })
  });
  if (loginRes.ok) {
    const rawCookie = loginRes.headers.get('set-cookie');
    if (rawCookie) cookie = rawCookie;
    console.log('Login success:', await loginRes.json());
  }

  console.log('\nTesting Role Authorization...');
  const roleRes1 = await fetch(`${baseUrl}/auth/admin-only`, {
    headers: { 'Cookie': cookie } // Logged in as OWNER
  });
  console.log('Admin only (as OWNER) expected fail:', await roleRes1.json());

  console.log('\nTesting LOGOUT...');
  const logoutRes = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });
  console.log('Logout result:', await logoutRes.json());

  const meRes2 = await fetch(`${baseUrl}/auth/me`, {
    headers: { 'Cookie': logoutRes.headers.get('set-cookie') || '' }
  });
  console.log('/me after logout expected fail:', await meRes2.json());
}

test().catch(console.error);
