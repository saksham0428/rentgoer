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
  console.log('--- STARTING VERIFICATION TESTS ---');

  const adminCookie = await createAndLogin('admin.verification@test.com', 'ADMIN');
  const ownerCookie = await createAndLogin('owner.verification@test.com', 'OWNER');
  const tenantCookie = await createAndLogin('tenant.verification@test.com', 'TENANT');
  
  const owner = await prisma.user.findUnique({ where: { email: 'owner.verification@test.com' } });
  
  let property = await prisma.property.findFirst({ where: { ownerId: owner!.id } });
  if (!property) { 
    property = await prisma.property.create({ 
      data: { ownerId: owner!.id, title: 'T', description: 'D', rent: 100, securityDeposit: 100, city: 'C', locality: 'L', address: 'A', bedrooms: 1, bathrooms: 1, propertyType: 'APARTMENT', furnishedStatus: 'FURNISHED', availableFrom: new Date() } 
    }); 
  }
  
  await prisma.verificationRequest.deleteMany({});
  await prisma.user.updateMany({ data: { isVerified: false, verifiedAt: null, verifiedById: null } });
  await prisma.property.updateMany({ data: { isVerified: false, verifiedAt: null, verifiedById: null } });

  console.log('Setup complete.');

  let res = await req('POST', '/verification/owner', ownerCookie);
  if (res.status !== 201) { console.log('POST /verification/owner failed:', res); } assert(res.status === 201, 'Owner should request verification');
  const ownerReqId = res.data.data.id;

  res = await req('POST', '/verification/owner', ownerCookie);
  assert(res.status === 409, 'Should fail duplicate pending owner request');

  res = await req('POST', `/properties/${property!.id}/verification`, ownerCookie);
  assert(res.status === 201);
  const propertyReqId = res.data.data.id;

  res = await req('POST', `/properties/${property!.id}/verification`, ownerCookie);
  assert(res.status === 409, 'Should fail duplicate pending property request');

  res = await req('GET', '/admin/verification', adminCookie);
  assert(res.status === 200);
  assert(res.data.data.length >= 2);

  res = await req('GET', '/admin/verification?type=OWNER', adminCookie);
  assert(res.data.data.every((r: any) => r.type === 'OWNER'));

  res = await req('GET', `/admin/verification/${ownerReqId}`, adminCookie);
  assert(res.status === 200 && res.data.data.id === ownerReqId);

  res = await req('PUT', `/admin/verification/${ownerReqId}/reject`, adminCookie, { reason: 'Incomplete documents' });
  assert(res.status === 200);

  res = await req('PUT', `/admin/verification/${ownerReqId}/reject`, adminCookie, { reason: 'Incomplete documents' });
  assert(res.status === 409);

  res = await req('POST', '/verification/owner', ownerCookie);
  assert(res.status === 201);
  const newOwnerReqId = res.data.data.id;

  res = await req('PUT', `/admin/verification/${newOwnerReqId}/approve`, adminCookie);
  assert(res.status === 200);

  res = await req('POST', '/verification/owner', ownerCookie);
  assert(res.status === 409, 'Verified owner should not request');

  res = await req('PUT', `/admin/verification/${propertyReqId}/approve`, adminCookie);
  assert(res.status === 200);

  res = await req('POST', '/verification/owner', tenantCookie);
  assert(res.status === 403);

  res = await req('GET', '/admin/verification', ownerCookie);
  assert(res.status === 403);

  console.log('--- ALL VERIFICATION TESTS PASSED ---');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
