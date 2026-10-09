import fetch from 'node-fetch';
import { prisma } from '../src/lib/prisma';

const API_URL = 'http://localhost:5000/api';

async function testRentalRequests() {
  console.log('--- SETUP ---');
  await prisma.rentalRequest.deleteMany({});
  
  // Register Tenant 1
  const t1Email = `t1_req_${Date.now()}@test.com`;
  let res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'T1', email: t1Email, password: 'password123', role: 'TENANT' })
  });
  let t1Cookie = res.headers.raw()['set-cookie']?.map(c => c.split(';')[0]).join('; ');

  // Register Tenant 2
  const t2Email = `t2_req_${Date.now()}@test.com`;
  res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'T2', email: t2Email, password: 'password123', role: 'TENANT' })
  });
  let t2Cookie = res.headers.raw()['set-cookie']?.map(c => c.split(';')[0]).join('; ');

  // Register Owner
  const oEmail = `o_req_${Date.now()}@test.com`;
  res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'O', email: oEmail, password: 'password123', role: 'OWNER' })
  });
  let oCookie = res.headers.raw()['set-cookie']?.map(c => c.split(';')[0]).join('; ');

  // Create Property
  res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: oCookie! },
    body: JSON.stringify({
      title: 'Req Prop', description: 'Testing requests', rent: 1000, city: 'City', locality: 'Locality',
      bedrooms: 1, bathrooms: 1, propertyType: 'APARTMENT', furnishedStatus: 'UNFURNISHED'
    })
  });
  const prop = await res.json() as any;
  const propId = prop.data.id;
  console.log('Property created:', propId);

  console.log('\n--- CREATE RENTAL REQUEST TESTS ---');

  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'I want this place' }) });
  console.log('1. Guest create request -> 401:', res.status === 401 ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: oCookie! }, body: JSON.stringify({ message: 'I want this place' }) });
  console.log('2. Owner create request -> 403:', res.status === 403 ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/properties/wrong-id/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t1Cookie! }, body: JSON.stringify({ message: 'I want this place' }) });
  console.log('4. Missing property -> 404:', res.status === 404 ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t1Cookie! } });
  console.log('6. Missing message -> 400:', res.status === 400 ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t1Cookie! }, body: JSON.stringify({ message: 'Short' }) });
  console.log('7. Message below 10 chars -> 400:', res.status === 400 ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t1Cookie! }, body: JSON.stringify({ message: 'I want this place please.' }) });
  const newReq = await res.json() as any;
  const reqId = newReq.data?.id;
  console.log('3. Tenant create request -> 201:', res.status === 201 && newReq.data.status === 'PENDING' ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t1Cookie! }, body: JSON.stringify({ message: 'I want this place please.', status: 'ACCEPTED' }) });
  console.log('9, 10. Duplicate PENDING request -> 409:', res.status === 409 ? 'PASS' : `FAIL (${res.status})`);

  // Manually change status to ACCEPTED
  await prisma.rentalRequest.update({ where: { id: reqId }, data: { status: 'ACCEPTED' } });
  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t1Cookie! }, body: JSON.stringify({ message: 'I want this place please.' }) });
  console.log('11. Duplicate ACCEPTED request -> 409:', res.status === 409 ? 'PASS' : `FAIL (${res.status})`);

  // Manually change status to REJECTED
  await prisma.rentalRequest.update({ where: { id: reqId }, data: { status: 'REJECTED' } });
  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t1Cookie! }, body: JSON.stringify({ message: 'I still want this place.' }) });
  const req2 = await res.json() as any;
  const reqId2 = req2.data?.id;
  console.log('12. New request after REJECTED -> allowed:', res.status === 201 ? 'PASS' : `FAIL (${res.status})`);

  // Cancel reqId2
  await prisma.rentalRequest.update({ where: { id: reqId2 }, data: { status: 'CANCELLED' } });
  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t1Cookie! }, body: JSON.stringify({ message: 'I still want this place!!' }) });
  const req3 = await res.json() as any;
  const reqId3 = req3.data?.id;
  console.log('13. New request after CANCELLED -> allowed:', res.status === 201 ? 'PASS' : `FAIL (${res.status})`);

  console.log('\n--- GET MY REQUESTS TESTS ---');
  res = await fetch(`${API_URL}/rental-requests/me`, { headers: { Cookie: t1Cookie! } });
  const myReqs = await res.json() as any;
  console.log('14. GET /me returns only current tenant:', res.status === 200 && myReqs.data.length === 3 ? 'PASS' : `FAIL (${myReqs.data?.length})`);

  res = await fetch(`${API_URL}/rental-requests/me`, { headers: { Cookie: oCookie! } });
  console.log('23. Owner cannot access GET /me -> 403:', res.status === 403 ? 'PASS' : `FAIL (${res.status})`);

  console.log('\n--- CANCEL TESTS ---');
  // reqId is REJECTED, reqId2 is CANCELLED, reqId3 is PENDING
  
  res = await fetch(`${API_URL}/rental-requests/${reqId3}`, { method: 'DELETE', headers: { Cookie: t2Cookie! } });
  console.log('22. Tenant cannot cancel another tenant req -> 403:', res.status === 403 ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/rental-requests/${reqId3}`, { method: 'DELETE', headers: { Cookie: t1Cookie! } });
  const cancelledReq = await res.json() as any;
  console.log('16, 17. Tenant can cancel own PENDING request -> CANCELLED:', res.status === 200 && cancelledReq.data?.status === 'CANCELLED' ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/rental-requests/${reqId}`, { method: 'DELETE', headers: { Cookie: t1Cookie! } });
  console.log('20. Cancel REJECTED -> 409:', res.status === 409 ? 'PASS' : `FAIL (${res.status})`);

  res = await fetch(`${API_URL}/rental-requests/${reqId2}`, { method: 'DELETE', headers: { Cookie: t1Cookie! } });
  console.log('21. Cancel CANCELLED -> 409:', res.status === 409 ? 'PASS' : `FAIL (${res.status})`);

  // Change prop to unavailable
  await prisma.property.update({ where: { id: propId }, data: { isAvailable: false } });
  res = await fetch(`${API_URL}/properties/${propId}/rental-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: t2Cookie! }, body: JSON.stringify({ message: 'I want this place please.' }) });
  console.log('5. Unavailable property -> 409:', res.status === 409 ? 'PASS' : `FAIL (${res.status})`);

  process.exit(0);
}

testRentalRequests();
