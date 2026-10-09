import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const baseUrl = 'http://localhost:5000/api';
let tenantCookie = '';
let ownerCookie = '';
let ownerId = '';
let propertyId = '';
let imageId = '';

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

async function createTestImage(filename) {
  const p = path.join(__dirname, filename);
  if (!fs.existsSync(p)) {
    // create a dummy 1x1 image
    const dummyImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(p, dummyImageBuffer);
  }
  return p;
}

async function testPropertyImages() {
  console.log('--- SETUP ---');
  const tEmail = `tenant${Date.now()}@test.com`;
  const tReg = await register('Tenant', tEmail, 'Password123!', 'TENANT');
  tenantCookie = tReg.cookie;
  
  const oEmail = `owner${Date.now()}@test.com`;
  const oReg = await register('Owner', oEmail, 'Password123!', 'OWNER');
  ownerCookie = oReg.cookie;
  ownerId = oReg.data.user.id;

  const oEmail2 = `owner2${Date.now()}@test.com`;
  const oReg2 = await register('Owner2', oEmail2, 'Password123!', 'OWNER');
  const ownerCookie2 = oReg2.cookie;

  const propRes = await fetch(`${baseUrl}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
    body: JSON.stringify({
      title: 'Test Prop',
      description: 'Desc',
      rent: 1000,
      city: 'City',
      locality: 'Locality',
      bedrooms: 1,
      bathrooms: 1,
      propertyType: 'APARTMENT',
      furnishedStatus: 'FURNISHED'
    })
  });
  const prop = await propRes.json();
  propertyId = prop.data.id;
  console.log('Property created:', propertyId);

  // Prepare dummy files
  const validJpgPath = await createTestImage('test1.jpg');
  const invalidTxtPath = path.join(__dirname, 'test.txt');
  fs.writeFileSync(invalidTxtPath, 'hello world');

  console.log('\n--- UPLOAD ---');
  
  const uploadFile = async (filePath, cookie, propId, fieldName = 'images', mimeType = 'image/jpeg') => {
    const formData = new FormData();
    formData.append(fieldName, fs.createReadStream(filePath), { contentType: mimeType });
    
    return fetch(`${baseUrl}/properties/${propId}/images`, {
      method: 'POST',
      headers: { 
        'Cookie': cookie,
        ...formData.getHeaders()
      },
      body: formData
    });
  };

  // 1. Unauth
  let res = await uploadFile(validJpgPath, '', propertyId);
  console.log('Unauthenticated:', res.status === 401 ? 'PASS' : 'FAIL');

  // 2. Tenant
  res = await uploadFile(validJpgPath, tenantCookie, propertyId);
  console.log('Tenant upload:', res.status === 403 ? 'PASS' : 'FAIL');

  // 3. Owner 2
  res = await uploadFile(validJpgPath, ownerCookie2, propertyId);
  console.log('Other owner upload:', res.status === 403 ? 'PASS' : 'FAIL');

  // 4. Invalid mime type
  res = await uploadFile(invalidTxtPath, ownerCookie, propertyId, 'images', 'text/plain');
  console.log('Invalid mime type:', res.status === 400 ? 'PASS' : 'FAIL');

  // 5. Valid Owner upload
  res = await uploadFile(validJpgPath, ownerCookie, propertyId);
  if (res.status === 201) {
    const data = await res.json();
    console.log('Owner valid upload:', 'PASS');
    imageId = data.data[0].id;
  } else {
    console.log('Owner valid upload FAIL:', res.status, await res.json());
  }

  console.log('\n--- GET PROPERTY ---');
  res = await fetch(`${baseUrl}/properties/${propertyId}`);
  const fetchedProp = await res.json();
  console.log('Property has images:', fetchedProp.data.images && fetchedProp.data.images.length > 0 ? 'PASS' : 'FAIL');

  console.log('\n--- DELETE ---');
  if (imageId) {
    // Tenant delete
    res = await fetch(`${baseUrl}/properties/${propertyId}/images/${imageId}`, { method: 'DELETE', headers: { 'Cookie': tenantCookie } });
    console.log('Tenant delete:', res.status === 403 ? 'PASS' : 'FAIL');

    // Other owner delete
    res = await fetch(`${baseUrl}/properties/${propertyId}/images/${imageId}`, { method: 'DELETE', headers: { 'Cookie': ownerCookie2 } });
    console.log('Other owner delete:', res.status === 403 ? 'PASS' : 'FAIL');

    // Owner delete
    res = await fetch(`${baseUrl}/properties/${propertyId}/images/${imageId}`, { method: 'DELETE', headers: { 'Cookie': ownerCookie } });
    console.log('Owner delete:', res.status === 200 ? 'PASS' : 'FAIL');
  }

  // Cleanup files
  try {
    fs.unlinkSync(validJpgPath);
    fs.unlinkSync(invalidTxtPath);
  } catch (e) {}

}

testPropertyImages().catch(console.error);
