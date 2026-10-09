import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

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
    res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: role + ' User', email, password, role })
    });
  }
  
  const cookies = res.headers.raw()['set-cookie'];
  return cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
}

async function runTests() {
  console.log('--- STARTING NOTIFICATIONS & TRANSACTION TESTS ---');

  const ownerToken = await generateToken('owner.notif@test.com', 'OWNER');
  const tenantAToken = await generateToken('tenantA.notif@test.com', 'TENANT');
  const tenantBToken = await generateToken('tenantB.notif@test.com', 'TENANT');
  const guestToken = await generateToken('guest.notif@test.com', 'TENANT');

  // Clear existing notifications for these users for clean test state
  await prisma.notification.deleteMany();

  // 1. Create property
  let res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({
      title: 'Notif Property', description: 'Test prop', rent: 1000, city: 'Delhi',
      locality: 'Saket', bedrooms: 2, bathrooms: 2, propertyType: 'APARTMENT',
      furnishedStatus: 'SEMI_FURNISHED'
    })
  });
  const propertyId = (await res.json()).data.id;

  // 2. Tenant A requests
  res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantAToken },
    body: JSON.stringify({ message: 'I would like to rent this place A' })
  });
  const tA = await res.text(); console.log('req A text:', tA);
  const reqAId = JSON.parse(tA).data.id;

  // Test: Owner receives RENTAL_REQUEST
  res = await fetch(`${API_URL}/notifications`, { headers: { 'Cookie': ownerToken } });
  let notifs = (await res.json()).data;
  if (notifs.length !== 1 || notifs[0].type !== 'RENTAL_REQUEST') {
    throw new Error('Owner should receive exactly ONE RENTAL_REQUEST notification');
  }

  // 3. Tenant B requests
  res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantBToken },
    body: JSON.stringify({ message: 'I would like to rent this place B' })
  });
  const text = await res.text();
  console.log('req B text:', text);
  const j = JSON.parse(text);
  const reqBId = j.data.id;

  // 4. Owner accepts Tenant B
  res = await fetch(`${API_URL}/rental-requests/${reqBId}/accept`, {
    method: 'POST', headers: { 'Cookie': ownerToken }
  });

  // Test: Tenant B receives REQUEST_ACCEPTED
  res = await fetch(`${API_URL}/notifications`, { headers: { 'Cookie': tenantBToken } });
  let bNotifs = (await res.json()).data;
  if (bNotifs.length !== 1 || bNotifs[0].type !== 'REQUEST_ACCEPTED') {
    throw new Error('Tenant B should receive REQUEST_ACCEPTED');
  }

  // Test: Tenant A receives REQUEST_REJECTED
  res = await fetch(`${API_URL}/notifications`, { headers: { 'Cookie': tenantAToken } });
  let aNotifs = (await res.json()).data;
  if (aNotifs.length !== 1 || aNotifs[0].type !== 'REQUEST_REJECTED') {
    throw new Error('Tenant A should receive REQUEST_REJECTED');
  }

  // Test: Chat notification
  res = await fetch(`${API_URL}/conversations`, { headers: { 'Cookie': tenantBToken } });
  const convId = (await res.json()).data[0].id;

  res = await fetch(`${API_URL}/conversations/${convId}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantBToken },
    body: JSON.stringify({ content: 'Hello Owner' })
  });

  res = await fetch(`${API_URL}/notifications`, { headers: { 'Cookie': ownerToken } });
  notifs = (await res.json()).data;
  if (notifs[0].type !== 'CHAT_MESSAGE') {
    throw new Error('Owner should receive CHAT_MESSAGE notification');
  }

  // Test: Pagination
  res = await fetch(`${API_URL}/notifications?page=1&limit=1`, { headers: { 'Cookie': ownerToken } });
  const paged = (await res.json()).data;
  if (paged.length !== 1) throw new Error('Pagination limit failed');

  // Test: Unread Count
  res = await fetch(`${API_URL}/notifications/unread-count`, { headers: { 'Cookie': ownerToken } });
  const count = (await res.json()).count;
  if (count !== 3) throw new Error('Unread count should be 3 for owner');

  // Test: Mark as read
  const firstNotifId = notifs[0].id;
  res = await fetch(`${API_URL}/notifications/${firstNotifId}/read`, {
    method: 'PUT', headers: { 'Cookie': ownerToken }
  });
  const updated = (await res.json()).data;
  if (!updated.isRead || !updated.readAt) throw new Error('Mark as read failed');

  // Test: IDOR (Guest cannot mark owner's notif as read)
  res = await fetch(`${API_URL}/notifications/${firstNotifId}/read`, {
    method: 'PUT', headers: { 'Cookie': guestToken }
  });
  if (res.status !== 404) throw new Error('Guest should not be able to mark other notif as read (404 expected)');

  console.log('--- ALL NOTIFICATION TESTS PASSED ---');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
