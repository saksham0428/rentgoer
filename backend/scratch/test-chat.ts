import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:5000/api';

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
  console.log('--- STARTING SECURITY & CHAT TESTS ---');

  const ownerToken = await generateToken('owner.sec@test.com', 'OWNER');
  const tenantToken = await generateToken('tenant.sec@test.com', 'TENANT');
  const otherUserToken = await generateToken('other.sec@test.com', 'TENANT');

  // 1. Create property
  let res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({
      title: 'Security Chat Property',
      description: 'Test prop',
      rent: 1000,
      city: 'Delhi',
      locality: 'Saket',
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'APARTMENT',
      furnishedStatus: 'SEMI_FURNISHED'
    })
  });
  const propertyId = (await res.json()).data.id;

  // 2. Tenant request
  res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ message: 'I would like to rent this place' })
  });
  const reqId = (await res.json()).data.id;

  // 3. Owner accepts request -> triggers conversation creation
  res = await fetch(`${API_URL}/rental-requests/${reqId}/accept`, {
    method: 'POST',
    headers: { 'Cookie': ownerToken }
  });

  // 4. Get conversation ID
  res = await fetch(`${API_URL}/conversations`, { headers: { 'Cookie': tenantToken } });
  let convs = (await res.json()).data;
  const convId = convs[0].id;

  // TEST: Unrelated user cannot access GET messages
  res = await fetch(`${API_URL}/conversations/${convId}/messages`, { headers: { 'Cookie': otherUserToken } });
  if (res.status !== 403) throw new Error('Unrelated user must get 403 on GET messages');

  // TEST: Unrelated user cannot access POST messages
  res = await fetch(`${API_URL}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': otherUserToken },
    body: JSON.stringify({ content: 'Hacked' })
  });
  if (res.status !== 403) throw new Error('Unrelated user must get 403 on POST messages');

  // TEST: Unrelated user cannot subscribe to SSE
  res = await fetch(`${API_URL}/conversations/${convId}/realtime`, { headers: { 'Cookie': otherUserToken } });
  if (res.status !== 403) throw new Error('Unrelated user must get 403 on SSE realtime subscription');

  // 5. Test SSE Realtime Delivery for authorized user
  console.log('Connecting authorized user (owner) to SSE...');
  let receivedMessage = false;

  const ssePromise = new Promise<void>((resolve, reject) => {
    fetch(`${API_URL}/conversations/${convId}/realtime`, {
      headers: { Cookie: ownerToken }
    }).then(res => {
      if (res.status !== 200) return reject(new Error('SSE Fetch failed: ' + res.status));
      res.body?.on('data', (chunk) => {
        const str = chunk.toString();
        if (str.includes('Hello from tenant via SSE')) {
          receivedMessage = true;
          resolve();
        }
      });
    }).catch(reject);
  });

  // Wait for SSE connection to establish
  await new Promise(r => setTimeout(r, 2000));

  // 6. Tenant sends message
  res = await fetch(`${API_URL}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ content: 'Hello from tenant via SSE' })
  });
  if (res.status !== 201) throw new Error('Tenant failed to send message');

  // Wait for delivery
  try {
    await Promise.race([
      ssePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
    ]);
  } catch (e) {
    throw new Error('Owner failed to receive message via SSE: ' + (e as any).message);
  }

  console.log('--- ALL SECURITY & CHAT TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
