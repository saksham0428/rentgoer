import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';

async function generateToken(email: string, role: string) {
  // Use a hacky way or just use the login endpoint if the user exists, but we need users
  // Wait, I will just register or login.
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
  console.log('--- STARTING OWNER RENTAL REQUEST TESTS ---');

  const owner1Token = await generateToken('owner1.req@test.com', 'OWNER');
  const owner2Token = await generateToken('owner2.req@test.com', 'OWNER');
  const tenant1Token = await generateToken('tenant1.req@test.com', 'TENANT');
  const tenant2Token = await generateToken('tenant2.req@test.com', 'TENANT');
  const tenant3Token = await generateToken('tenant3.req@test.com', 'TENANT');

  // 1. Owner 1 creates a property
  let res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': owner1Token },
    body: JSON.stringify({
      title: 'Owner 1 Property',
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
  const propertyRes = await res.json();
  console.log('propertyRes:', propertyRes);
  const propertyId = propertyRes.data.id;

  // 2. Tenants request it
  res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenant1Token },
    body: JSON.stringify({ message: 'I would like to rent this place' })
  });
  const t1ReqRes = await res.json(); console.log('t1ReqRes:', t1ReqRes);
  const req1Id = t1ReqRes.data.id;

  res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenant2Token },
    body: JSON.stringify({ message: 'I also would like to rent this place' })
  });
  const t2ReqRes = await res.json(); console.log('t2ReqRes:', t2ReqRes);
  const req2Id = t2ReqRes.data.id;

  res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenant3Token },
    body: JSON.stringify({ message: 'I am tenant 3 and I want it' })
  });
  const t3ReqRes = await res.json(); console.log('t3ReqRes:', t3ReqRes);
  const req3Id = t3ReqRes.data.id;

  console.log('--- AUTHORIZATION TESTS ---');

  // Guest GET owner requests
  res = await fetch(`${API_URL}/rental-requests/owner`);
  console.assert(res.status === 401, 'Guest GET owner requests should be 401');

  // Tenant GET owner requests
  res = await fetch(`${API_URL}/rental-requests/owner`, { headers: { 'Cookie': tenant1Token } });
  console.assert(res.status === 403, 'Tenant GET owner requests should be 403');

  // Owner GET owner requests
  res = await fetch(`${API_URL}/rental-requests/owner`, { headers: { 'Cookie': owner1Token } });
  console.assert(res.status === 200, 'Owner GET owner requests should be 200');

  // Guest accept
  res = await fetch(`${API_URL}/rental-requests/${req1Id}/accept`, { method: 'POST' });
  console.assert(res.status === 401, 'Guest accept should be 401');

  // Tenant accept
  res = await fetch(`${API_URL}/rental-requests/${req1Id}/accept`, { method: 'POST', headers: { 'Cookie': tenant1Token } });
  console.assert(res.status === 403, 'Tenant accept should be 403');

  // Owner 2 accept (ISOLATION)
  res = await fetch(`${API_URL}/rental-requests/${req1Id}/accept`, { method: 'POST', headers: { 'Cookie': owner2Token } });
  console.assert(res.status === 403, 'Owner 2 accept should be 403');

  // Owner 2 reject (ISOLATION)
  res = await fetch(`${API_URL}/rental-requests/${req1Id}/reject`, { method: 'POST', headers: { 'Cookie': owner2Token } });
  console.assert(res.status === 403, 'Owner 2 reject should be 403');

  console.log('--- REJECT TEST ---');

  // Owner 1 reject req3
  res = await fetch(`${API_URL}/rental-requests/${req3Id}/reject`, { method: 'POST', headers: { 'Cookie': owner1Token } });
  console.assert(res.status === 200, 'Owner 1 reject req3 should be 200');
  
  // Verify request is REJECTED
  let req3Status = (await res.json()).data.status;
  console.assert(req3Status === 'REJECTED', 'Req3 status should be REJECTED');

  // Verify property is still available
  res = await fetch(`${API_URL}/properties/${propertyId}`);
  let propInfo = await res.json();
  console.assert(propInfo.data.isAvailable === true, 'Property should still be available after reject');

  console.log('--- ACCEPT TEST ---');

  // Owner 1 accept req1
  res = await fetch(`${API_URL}/rental-requests/${req1Id}/accept`, { method: 'POST', headers: { 'Cookie': owner1Token } });
  console.assert(res.status === 200, 'Owner 1 accept req1 should be 200');

  // Verify request is ACCEPTED
  let req1Status = (await res.json()).data.status;
  console.assert(req1Status === 'ACCEPTED', 'Req1 status should be ACCEPTED');

  // Verify property is unavailable
  res = await fetch(`${API_URL}/properties/${propertyId}`);
  propInfo = await res.json();
  console.assert(propInfo.data.isAvailable === false, 'Property should be unavailable after accept');

  // Verify req2 became REJECTED
  res = await fetch(`${API_URL}/rental-requests/me`, { headers: { 'Cookie': tenant2Token } });
  let t2Reqs = (await res.json()).data;
  console.assert(t2Reqs.find((r: any) => r.id === req2Id).status === 'REJECTED', 'Req2 should be auto REJECTED');

  // Verify req3 remains REJECTED
  res = await fetch(`${API_URL}/rental-requests/me`, { headers: { 'Cookie': tenant3Token } });
  let t3Reqs = (await res.json()).data;
  console.assert(t3Reqs.find((r: any) => r.id === req3Id).status === 'REJECTED', 'Req3 should remain REJECTED');

  console.log('--- INVALID TRANSITIONS ---');

  // Accept ACCEPTED
  res = await fetch(`${API_URL}/rental-requests/${req1Id}/accept`, { method: 'POST', headers: { 'Cookie': owner1Token } });
  console.assert(res.status === 409, 'Accept ACCEPTED should be 409');

  // Reject ACCEPTED
  res = await fetch(`${API_URL}/rental-requests/${req1Id}/reject`, { method: 'POST', headers: { 'Cookie': owner1Token } });
  console.assert(res.status === 409, 'Reject ACCEPTED should be 409');

  // Accept REJECTED
  res = await fetch(`${API_URL}/rental-requests/${req2Id}/accept`, { method: 'POST', headers: { 'Cookie': owner1Token } });
  console.assert(res.status === 409, 'Accept REJECTED should be 409');

  console.log('--- ALL TESTS COMPLETED SUCCESSFULLY ---');
}

runTests().catch(console.error);
