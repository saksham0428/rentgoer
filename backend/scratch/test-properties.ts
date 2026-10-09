const baseUrl = 'http://localhost:5000/api';
let tenantCookie = '';
let ownerCookie = '';
let ownerId = '';
let propertyId = '';

async function login(email, password) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  const rawCookie = res.headers.get('set-cookie');
  return { data, cookie: rawCookie };
}

async function register(name, email, password, role) {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role })
  });
  const data = await res.json();
  const rawCookie = res.headers.get('set-cookie');
  return { data, cookie: rawCookie };
}

async function testProperties() {
  console.log('--- SETUP ---');
  // Register/login Tenant
  const tEmail = `tenant${Date.now()}@test.com`;
  const tReg = await register('Tenant', tEmail, 'Password123!', 'TENANT');
  tenantCookie = tReg.cookie;
  
  // Register/login Owner
  const oEmail = `owner${Date.now()}@test.com`;
  const oReg = await register('Owner', oEmail, 'Password123!', 'OWNER');
  ownerCookie = oReg.cookie;
  ownerId = oReg.data.user.id;

  const otherOwnerEmail = `otherowner${Date.now()}@test.com`;
  const otherOwnerReg = await register('Other Owner', otherOwnerEmail, 'Password123!', 'OWNER');
  const otherOwnerCookie = otherOwnerReg.cookie;

  console.log('\n--- CREATE PROPERTY ---');
  const propertyData = {
    title: 'Test Apartment',
    description: 'A nice place',
    rent: 15000,
    securityDeposit: 30000,
    city: 'New York',
    locality: 'Manhattan',
    address: '123 Test St',
    bedrooms: 1,
    bathrooms: 1,
    propertyType: 'APARTMENT',
    furnishedStatus: 'FURNISHED'
  };

  // 1. Unauthenticated gets 401
  let res = await fetch(`${baseUrl}/properties`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(propertyData) });
  console.log('Unauthenticated POST:', res.status === 401 ? 'PASS (401)' : 'FAIL', await res.json());

  // 2. Tenant gets 403
  res = await fetch(`${baseUrl}/properties`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantCookie }, body: JSON.stringify(propertyData) });
  console.log('Tenant POST:', res.status === 403 ? 'PASS (403)' : 'FAIL', await res.json());

  // 3. Owner creates successfully
  res = await fetch(`${baseUrl}/properties`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie }, body: JSON.stringify(propertyData) });
  const createdProp = await res.json();
  if (res.status === 201) {
    console.log('Owner POST: PASS (201)', createdProp.data.id);
    propertyId = createdProp.data.id;
  } else {
    console.log('Owner POST: FAIL', createdProp);
  }

  console.log('\n--- GET PROPERTIES ---');
  res = await fetch(`${baseUrl}/properties`);
  const list = await res.json();
  console.log('Public GET all:', res.status === 200 ? 'PASS (200)' : 'FAIL', 'Count:', list.data.length);

  res = await fetch(`${baseUrl}/properties/${propertyId}`);
  const single = await res.json();
  console.log('Public GET by ID:', res.status === 200 ? 'PASS (200)' : 'FAIL', single.data.title);

  res = await fetch(`${baseUrl}/properties/missing-id-123`);
  console.log('GET missing ID:', res.status === 404 ? 'PASS (404)' : 'FAIL');

  console.log('\n--- UPDATE PROPERTY ---');
  const updateData = { ...propertyData, title: 'Updated Title' };
  
  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) });
  console.log('Unauthenticated PUT:', res.status === 401 ? 'PASS (401)' : 'FAIL');
  
  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': tenantCookie }, body: JSON.stringify(updateData) });
  console.log('Tenant PUT:', res.status === 403 ? 'PASS (403)' : 'FAIL');
  
  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': otherOwnerCookie }, body: JSON.stringify(updateData) });
  console.log('Other Owner PUT:', res.status === 403 ? 'PASS (403)' : 'FAIL', await res.json());
  
  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie }, body: JSON.stringify(updateData) });
  const updated = await res.json();
  console.log('Owner PUT:', res.status === 200 ? 'PASS (200)' : 'FAIL', updated.data.title);

  console.log('\n--- DELETE PROPERTY ---');
  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'DELETE' });
  console.log('Unauthenticated DELETE:', res.status === 401 ? 'PASS (401)' : 'FAIL');

  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'DELETE', headers: { 'Cookie': tenantCookie } });
  console.log('Tenant DELETE:', res.status === 403 ? 'PASS (403)' : 'FAIL');

  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'DELETE', headers: { 'Cookie': otherOwnerCookie } });
  console.log('Other Owner DELETE:', res.status === 403 ? 'PASS (403)' : 'FAIL');

  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'DELETE', headers: { 'Cookie': ownerCookie } });
  console.log('Owner DELETE:', res.status === 200 ? 'PASS (200)' : 'FAIL');

  res = await fetch(`${baseUrl}/properties/${propertyId}`, { method: 'DELETE', headers: { 'Cookie': ownerCookie } });
  console.log('Delete missing property:', res.status === 404 ? 'PASS (404)' : 'FAIL');

}

testProperties().catch(console.error);
