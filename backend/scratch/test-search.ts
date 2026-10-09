const baseUrl = 'http://localhost:5000/api';

async function testSearch() {
  const q = async (query = '') => {
    const res = await fetch(`${baseUrl}/properties${query ? '?' + query : ''}`);
    const data = await res.json();
    return { status: res.status, data };
  };

  console.log('--- BASIC ---');
  let res = await q();
  console.log('Basic GET:', res.status === 200 ? 'PASS' : 'FAIL', res.data.pagination);

  console.log('\n--- LOCATION ---');
  res = await q('city=Chandigarh');
  console.log('City exact:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('city=chan');
  console.log('City partial case-insensitive:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('locality=sec');
  console.log('Locality partial:', res.status === 200 ? 'PASS' : 'FAIL');

  console.log('\n--- RENT ---');
  res = await q('minRent=5000');
  console.log('Min rent:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('maxRent=20000');
  console.log('Max rent:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('minRent=5000&maxRent=20000');
  console.log('Min + Max rent:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('minRent=20000&maxRent=5000');
  console.log('Min > Max error:', res.status === 400 ? 'PASS' : 'FAIL');
  res = await q('minRent=-10');
  console.log('Negative rent error:', res.status === 400 ? 'PASS' : 'FAIL');

  console.log('\n--- PROPERTY ATTRIBUTES ---');
  res = await q('bedrooms=2');
  console.log('Bedrooms:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('bathrooms=1');
  console.log('Bathrooms:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('propertyType=APARTMENT');
  console.log('PropertyType valid:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('propertyType=INVALID');
  console.log('PropertyType invalid:', res.status === 400 ? 'PASS' : 'FAIL');
  res = await q('furnishedStatus=FURNISHED');
  console.log('FurnishedStatus valid:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('furnishedStatus=INVALID');
  console.log('FurnishedStatus invalid:', res.status === 400 ? 'PASS' : 'FAIL');
  res = await q('isAvailable=true');
  console.log('isAvailable true:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('isAvailable=false');
  console.log('isAvailable false:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('isAvailable=notbool');
  console.log('isAvailable invalid:', res.status === 400 ? 'PASS' : 'FAIL');

  console.log('\n--- SORTING ---');
  res = await q('sortBy=newest');
  console.log('Sort newest:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('sortBy=rent_asc');
  console.log('Sort rent_asc:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('sortBy=rent_desc');
  console.log('Sort rent_desc:', res.status === 200 ? 'PASS' : 'FAIL');
  res = await q('sortBy=invalid');
  console.log('Sort invalid:', res.status === 400 ? 'PASS' : 'FAIL');

  console.log('\n--- PAGINATION ---');
  res = await q('page=1&limit=5');
  console.log('Valid page/limit:', res.status === 200 ? 'PASS' : 'FAIL', res.data.pagination);
  res = await q('page=0');
  console.log('Page < 1:', res.status === 400 ? 'PASS' : 'FAIL');
  res = await q('limit=51');
  console.log('Limit > 50:', res.status === 400 ? 'PASS' : 'FAIL');
  res = await q('limit=0');
  console.log('Limit < 1:', res.status === 400 ? 'PASS' : 'FAIL');

  console.log('\n--- COMBINED ---');
  res = await q('city=chan&minRent=5000&maxRent=50000&bedrooms=2&propertyType=APARTMENT&furnishedStatus=FURNISHED&sortBy=rent_asc&page=1&limit=10');
  console.log('Combined complex filter:', res.status === 200 ? 'PASS' : 'FAIL');

  console.log('\n--- EMPTY RESULT ---');
  res = await q('city=MarsCityNotExists&minRent=1000000');
  console.log('Empty result status:', res.status === 200 ? 'PASS' : 'FAIL');
  console.log('Empty result length:', res.data.data.length === 0 ? 'PASS' : 'FAIL');
  console.log('Empty result pagination total:', res.data.pagination.total === 0 ? 'PASS' : 'FAIL');
}

testSearch().catch(console.error);
