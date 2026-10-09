import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

dotenv.config();

const API_URL = 'http://localhost:5000/api';
const prisma = new PrismaClient();

async function generateToken(email: string, role: string) {
  const password = 'Password123!';
  let res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (res.status === 401 || res.status === 404) {
    if (role === 'ADMIN') {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({ data: { name: 'Admin', email, passwordHash, role: 'ADMIN' } });
      res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    } else {
      res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: role + ' User', email, password, role })
      });
    }
  }
  
  const cookies = res.headers.raw()['set-cookie'];
  return cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
}

async function runTests() {
  console.log('--- STARTING REPORTS TESTS ---');

  const adminToken = await generateToken('admin.report@test.com', 'ADMIN');
  const ownerToken = await generateToken('owner.report@test.com', 'OWNER');
  const tenantToken = await generateToken('tenant.report@test.com', 'TENANT');
  const otherTenantToken = await generateToken('other.tenant.report@test.com', 'TENANT');
  
  // Get tenant ID
  let res = await fetch(`${API_URL}/auth/me`, { headers: { 'Cookie': tenantToken } });
  let resJson = await res.json();
  if (!resJson.user) throw new Error('Failed to fetch me: ' + JSON.stringify(resJson));
  const tenantId = resJson.user.id;

  // Get other tenant ID
  res = await fetch(`${API_URL}/auth/me`, { headers: { 'Cookie': otherTenantToken } });
  resJson = await res.json();
  const otherTenantId = resJson.user.id;

  await prisma.report.deleteMany();

  // Create property
  res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({
      title: 'Report Property', description: 'Test prop', rent: 1000, city: 'Delhi',
      locality: 'Saket', bedrooms: 2, bathrooms: 2, propertyType: 'APARTMENT',
      furnishedStatus: 'SEMI_FURNISHED'
    })
  });
  const propertyId = (await res.json()).data.id;

  // Create conversation and message
  const conversation = await prisma.conversation.create({
    data: {
      rentalRequestId: (await prisma.rentalRequest.create({ data: { tenantId, propertyId, status: 'ACCEPTED' } })).id,
      propertyId,
      tenantId,
      ownerId: (await prisma.property.findUnique({ where: { id: propertyId } }))!.ownerId
    }
  });

  const msg = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: tenantId,
      content: 'Hello'
    }
  });
  const messageId = msg.id;

  // TESTS

  // 1. Tenant can report property
  res = await fetch(`${API_URL}/properties/${propertyId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ reason: 'FRAUD', description: 'Looks fake' })
  });
  if (res.status !== 201) throw new Error('Tenant failed to report property');

  // 2. Duplicate OPEN report rejected
  res = await fetch(`${API_URL}/properties/${propertyId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ reason: 'SCAM', description: 'Still looks fake' })
  });
  if (res.status !== 409) throw new Error('Duplicate property report should be 409');

  // 3. Invalid target type rejected
  res = await fetch(`${API_URL}/reports`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ targetType: 'INVALID', targetId: propertyId, reason: 'FRAUD', description: 'fake' })
  });
  if (res.status !== 400) throw new Error('Invalid targetType should be 400');

  // 4. Invalid reason rejected
  res = await fetch(`${API_URL}/properties/${propertyId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': otherTenantToken },
    body: JSON.stringify({ reason: 'BAD_VIBES', description: 'fake' })
  });
  if (res.status !== 400) throw new Error('Invalid reason should be 400');

  // 5. Nonexistent property
  res = await fetch(`${API_URL}/properties/fake-id/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ reason: 'FRAUD', description: 'fake' })
  });
  if (res.status !== 400 && res.status !== 404) throw new Error('Nonexistent property should be 400/404');

  // 6. Owner reports another user
  res = await fetch(`${API_URL}/users/${tenantId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({ reason: 'HARASSMENT', description: 'Abusive messages' })
  });
  if (res.status !== 201) throw new Error('Owner failed to report user');

  // 7. Self user report rejected
  res = await fetch(`${API_URL}/users/${tenantId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ reason: 'OTHER', description: 'Report myself' })
  });
  if (res.status !== 400) throw new Error('Self report should be 400');

  // 8. Self property report rejected
  res = await fetch(`${API_URL}/properties/${propertyId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({ reason: 'OTHER', description: 'Report my prop' })
  });
  if (res.status !== 400) throw new Error('Self property report should be 400');

  // 9. Auth participant can report message
  res = await fetch(`${API_URL}/messages/${messageId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({ reason: 'SPAM', description: 'spam message' })
  });
  if (res.status !== 201) throw new Error('Auth participant failed to report message');

  // 10. Cannot report own message
  res = await fetch(`${API_URL}/messages/${messageId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ reason: 'SPAM', description: 'spam message' })
  });
  if (res.status !== 400) throw new Error('Should not report own message');

  // 11. User outside conversation cannot report message
  res = await fetch(`${API_URL}/messages/${messageId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': otherTenantToken },
    body: JSON.stringify({ reason: 'SPAM', description: 'spam message' })
  });
  if (res.status !== 403) throw new Error('User outside conversation should be 403');

  // 12. User can retrieve own reports
  res = await fetch(`${API_URL}/reports/me`, { headers: { 'Cookie': tenantToken } });
  let myReports = (await res.json()).data;
  if (!myReports || myReports.length !== 1) throw new Error('User retrieve own reports failed');

  // 13. Tenant cannot access admin report list
  res = await fetch(`${API_URL}/admin/reports`, { headers: { 'Cookie': tenantToken } });
  if (res.status !== 403) throw new Error('Tenant should not access admin list');

  // 14. Admin can list reports
  res = await fetch(`${API_URL}/admin/reports`, { headers: { 'Cookie': adminToken } });
  if (res.status !== 200) throw new Error('Admin failed to list reports: ' + res.status + ' ' + await res.text());
  let adminReports = (await res.json()).data;
  if (adminReports.length < 2) throw new Error('Admin reports missing');

  // 15. Admin inspect report
  const reportId = adminReports[0].id;
  res = await fetch(`${API_URL}/admin/reports/${reportId}`, { headers: { 'Cookie': adminToken } });
  if (res.status !== 200) throw new Error('Admin failed to inspect report');

  // 16. Tenant cannot change report status
  res = await fetch(`${API_URL}/admin/reports/${reportId}/status`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ status: 'RESOLVED' })
  });
  if (res.status !== 403) throw new Error('Tenant should not change status');

  // 17. Admin can change valid status and add note
  res = await fetch(`${API_URL}/admin/reports/${reportId}/status`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': adminToken },
    body: JSON.stringify({ status: 'RESOLVED', moderatorNote: 'Fixed' })
  });
  if (res.status !== 200) throw new Error('Admin failed to change status');
  let updatedReport = (await res.json()).data;
  if (updatedReport.status !== 'RESOLVED' || updatedReport.moderatorNote !== 'Fixed') throw new Error('Admin status/note update failed');

  // 18. Cannot transition from RESOLVED
  res = await fetch(`${API_URL}/admin/reports/${reportId}/status`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': adminToken },
    body: JSON.stringify({ status: 'REVIEWING' })
  });
  if (res.status !== 400) throw new Error('Admin should not transition closed report');

  // 19. New report allowed after RESOLVED
  // First, figure out which report was resolved. If it was the property report by tenant, then we can try again.
  // We'll just have tenant report property again.
  res = await fetch(`${API_URL}/properties/${propertyId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ reason: 'FRAUD', description: 'Looks fake again' })
  });
  // Note: if the first report wasn't the tenant's property report, this might return 409. 
  // Let's resolve ALL open reports first to be sure.
  const allReports = adminReports;
  for (let r of allReports) {
    if (r.status === 'OPEN') {
      await fetch(`${API_URL}/admin/reports/${r.id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': adminToken },
        body: JSON.stringify({ status: 'DISMISSED' })
      });
    }
  }

  // Now new report MUST be allowed
  res = await fetch(`${API_URL}/properties/${propertyId}/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ reason: 'FRAUD', description: 'Looks fake again' })
  });
  if (res.status !== 201) throw new Error('New report allowed after RESOLVED failed: ' + res.status);

  console.log('--- ALL REPORTS TESTS PASSED ---');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
