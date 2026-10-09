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

async function runSSETests() {
  console.log('--- STARTING NOTIFICATION SSE TESTS ---');

  const ownerToken = await generateToken('owner.sse@test.com', 'OWNER');
  const tenantToken = await generateToken('tenant.sse@test.com', 'TENANT');
  const otherToken = await generateToken('other.sse@test.com', 'TENANT');

  // Create property
  let res = await fetch(`${API_URL}/properties`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({
      title: 'SSE Property', description: 'Test', rent: 1000, city: 'Delhi',
      locality: 'Saket', bedrooms: 2, bathrooms: 2, propertyType: 'APARTMENT',
      furnishedStatus: 'SEMI_FURNISHED'
    })
  });
  const propertyId = (await res.json()).data.id;

  // Setup SSE for owner
  let ownerReceived = 0;
  const ssePromise = new Promise<void>((resolve, reject) => {
    fetch(`${API_URL}/notifications/realtime`, { headers: { Cookie: ownerToken } })
      .then(res => {
        if (res.status !== 200) return reject(new Error('SSE Fetch failed'));
        res.body?.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes('RENTAL_REQUEST')) {
            ownerReceived++;
            resolve();
          }
        });
      }).catch(reject);
  });

  // Setup SSE for other user
  let otherReceived = 0;
  fetch(`${API_URL}/notifications/realtime`, { headers: { Cookie: otherToken } })
    .then(res => {
      res.body?.on('data', (chunk) => {
        otherReceived++;
      });
    });

  await new Promise(r => setTimeout(r, 2000));

  // Trigger notification
  res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ message: 'I would like to rent this SSE place' })
  });
  if (res.status !== 201) throw new Error('Failed to create request');

  await Promise.race([
    ssePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for SSE')), 3000))
  ]);

  if (ownerReceived !== 1) throw new Error('Owner should receive exactly 1 SSE notification');
  if (otherReceived !== 0) throw new Error('Other user should receive 0 SSE notifications');

  // IDOR test
  res = await fetch(`${API_URL}/notifications/realtime`);
  if (res.status !== 401) throw new Error('Guest must get 401 on SSE endpoint');

  console.log('--- ALL SSE TESTS PASSED ---');
  process.exit(0);
}

runSSETests().catch(e => {
  console.error(e);
  process.exit(1);
});
