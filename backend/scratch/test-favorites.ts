import fetch from 'node-fetch';
import { prisma } from '../src/lib/prisma';

const API_URL = 'http://localhost:5000/api';

async function testFavorites() {
  console.log('--- SETUP ---');
  await prisma.favorite.deleteMany({});
  
  // Register Tenant
  const tenantEmail = `tenant_fav_${Date.now()}@test.com`;
  let res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Fav Tenant', email: tenantEmail, password: 'password123', role: 'TENANT' })
  });
  let tenantCookie = res.headers.raw()['set-cookie']?.map(c => c.split(';')[0]).join('; ');

  // Register Owner
  const ownerEmail = `owner_fav_${Date.now()}@test.com`;
  res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Fav Owner', email: ownerEmail, password: 'password123', role: 'OWNER' })
  });
  let ownerCookie = res.headers.raw()['set-cookie']?.map(c => c.split(';')[0]).join('; ');

  // Create Property
  res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerCookie! },
    body: JSON.stringify({
      title: 'Fav Test Prop', description: 'Testing favorites', rent: 1000, city: 'City', locality: 'Locality',
      bedrooms: 1, bathrooms: 1, propertyType: 'APARTMENT', furnishedStatus: 'UNFURNISHED'
    })
  });
  const prop = await res.json() as any;
  const propId = prop.data.id;
  console.log('Property created:', propId);

  console.log('\n--- FAVORITE TESTS ---');

  // 1. Guest POST
  res = await fetch(`${API_URL}/properties/${propId}/favorite`, { method: 'POST' });
  console.log('Guest POST favorite:', res.status === 401 ? 'PASS (401)' : `FAIL (${res.status})`);

  // 2. Owner POST
  res = await fetch(`${API_URL}/properties/${propId}/favorite`, { method: 'POST', headers: { Cookie: ownerCookie! } });
  console.log('Owner POST favorite:', res.status === 403 ? 'PASS (403)' : `FAIL (${res.status})`);

  // 3. Tenant POST
  res = await fetch(`${API_URL}/properties/${propId}/favorite`, { method: 'POST', headers: { Cookie: tenantCookie! } });
  const favData1 = await res.json() as any;
  console.log('Tenant POST favorite:', res.status === 200 && favData1.data?.favorited ? 'PASS (200)' : `FAIL (${res.status})`);

  // 4. Tenant POST duplicate
  res = await fetch(`${API_URL}/properties/${propId}/favorite`, { method: 'POST', headers: { Cookie: tenantCookie! } });
  const favData2 = await res.json() as any;
  console.log('Tenant duplicate POST favorite:', res.status === 200 && favData2.data?.favorited ? 'PASS (200, idempotent)' : `FAIL (${res.status})`);

  // 5. Tenant GET favorites
  res = await fetch(`${API_URL}/favorites`, { headers: { Cookie: tenantCookie! } });
  const getFavs = await res.json() as any;
  console.log('Tenant GET favorites:', getFavs.data?.length === 1 && getFavs.data[0].id === propId ? 'PASS' : 'FAIL');

  // 6. Tenant GET favorite IDs
  res = await fetch(`${API_URL}/favorites/ids`, { headers: { Cookie: tenantCookie! } });
  const getFavIds = await res.json() as any;
  console.log('Tenant GET favorite IDs:', getFavIds.data?.includes(propId) ? 'PASS' : 'FAIL');

  // 7. Tenant DELETE favorite
  res = await fetch(`${API_URL}/properties/${propId}/favorite`, { method: 'DELETE', headers: { Cookie: tenantCookie! } });
  const unFavData = await res.json() as any;
  console.log('Tenant DELETE favorite:', res.status === 200 && unFavData.data?.favorited === false ? 'PASS (200)' : `FAIL (${res.status})`);

  // 8. Tenant GET favorites after delete
  res = await fetch(`${API_URL}/favorites`, { headers: { Cookie: tenantCookie! } });
  const getFavsEmpty = await res.json() as any;
  console.log('Tenant GET favorites after delete:', getFavsEmpty.data?.length === 0 ? 'PASS' : 'FAIL');

  // 9. Nonexistent property
  res = await fetch(`${API_URL}/properties/wrong-id/favorite`, { method: 'POST', headers: { Cookie: tenantCookie! } });
  console.log('Nonexistent property POST:', res.status === 404 ? 'PASS (404)' : `FAIL (${res.status})`);

  process.exit(0);
}

testFavorites();
