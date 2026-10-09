import { PrismaClient } from '@prisma/client';
import { assert } from 'console';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

async function req(method: string, path: string, cookie: string, body?: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function createAndLogin(email: string, role: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: role, passwordHash: await bcrypt.hash('password123', 10), role: role as any } });
  }
  const h = await fetch('http://localhost:5000/api/auth/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password: 'password123'})});
  return h.headers.get('set-cookie')!.split(';')[0];
}

async function runTests() {
  console.log('--- STARTING ADMIN TESTS ---');

  const adminCookie = await createAndLogin('admin.dashboard@test.com', 'ADMIN');
  const tenantCookie = await createAndLogin('tenant.dashboard@test.com', 'TENANT');
  const ownerCookie = await createAndLogin('owner.dashboard@test.com', 'OWNER');
  
  console.log('Setup complete.');

  // 1. ADMIN AUTH
  let res = await req('GET', '/admin/stats', adminCookie);
  assert(res.status === 200, 'Admin can access stats');
  assert(res.data.data.users !== undefined);

  res = await req('GET', '/admin/stats', tenantCookie);
  assert(res.status === 403, 'Tenant cannot access stats');

  res = await req('GET', '/admin/stats', ownerCookie);
  assert(res.status === 403, 'Owner cannot access stats');

  res = await req('GET', '/admin/stats', '');
  assert(res.status === 401, 'Guest cannot access stats');

  // 2. USERS
  res = await req('GET', '/admin/users', adminCookie);
  assert(res.status === 200);
  assert(res.data.data.length > 0);

  const userId = res.data.data[0].id;
  res = await req('GET', `/admin/users/${userId}`, adminCookie);
  assert(res.status === 200);
  assert(res.data.data.id === userId);
  assert(res.data.data.passwordHash === undefined, 'Must not expose passwordHash');

  res = await req('GET', `/admin/users/${userId}`, tenantCookie);
  assert(res.status === 403);

  // 3. PROPERTIES
  res = await req('GET', '/admin/properties', adminCookie);
  assert(res.status === 200);

  if (res.data.data.length > 0) {
    const propId = res.data.data[0].id;
    res = await req('GET', `/admin/properties/${propId}`, adminCookie);
    assert(res.status === 200);
    assert(res.data.data.id === propId);

    res = await req('GET', `/admin/properties/${propId}`, tenantCookie);
    assert(res.status === 403);
  }

  // 4. REPORTS
  res = await req('GET', '/admin/reports', adminCookie);
  assert(res.status === 200);

  if (res.data.data.length > 0) {
    const reportId = res.data.data[0].id;
    res = await req('GET', `/admin/reports/${reportId}`, adminCookie);
    assert(res.status === 200);

    // IDOR check
    res = await req('GET', `/admin/reports/${reportId}`, tenantCookie);
    assert(res.status === 403);
  }

  console.log('--- ALL ADMIN TESTS PASSED ---');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
