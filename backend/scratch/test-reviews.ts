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
  console.log('--- STARTING REVIEWS TESTS ---');

  const ownerToken = await generateToken('owner.reviews@test.com', 'OWNER');
  const tenantToken = await generateToken('tenant.reviews@test.com', 'TENANT');
  const otherTenantToken = await generateToken('other.tenant.reviews@test.com', 'TENANT');
  const otherOwnerToken = await generateToken('other.owner.reviews@test.com', 'OWNER');

  await prisma.review.deleteMany();

  // Create property
  let res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({
      title: 'Review Property', description: 'Test prop', rent: 1000, city: 'Delhi',
      locality: 'Saket', bedrooms: 2, bathrooms: 2, propertyType: 'APARTMENT',
      furnishedStatus: 'SEMI_FURNISHED'
    })
  });
  const propertyId = (await res.json()).data.id;

  // Tenant requests
  res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ message: 'I want to rent' })
  });
  const reqId = (await res.json()).data.id;

  // Test: owner cannot complete pending
  res = await fetch(`${API_URL}/rental-requests/${reqId}/complete`, { method: 'POST', headers: { 'Cookie': ownerToken }});
  if (res.status !== 409) throw new Error('Owner should not be able to complete PENDING request');

  // Test: tenant cannot review pending
  res = await fetch(`${API_URL}/properties/${propertyId}/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ rentalRequestId: reqId, rating: 5, comment: 'Nice enough' })
  });
  console.log(res.status, await res.text()); if (res.status !== 400) throw new Error('Tenant should not be able to review PENDING request');

  // Owner accepts
  res = await fetch(`${API_URL}/rental-requests/${reqId}/accept`, { method: 'POST', headers: { 'Cookie': ownerToken } });

  // Test: tenant cannot review accepted
  res = await fetch(`${API_URL}/properties/${propertyId}/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ rentalRequestId: reqId, rating: 5, comment: 'Nice enough' })
  });
  if (res.status !== 400) throw new Error('Tenant should not be able to review ACCEPTED request');

  // Test: Tenant cannot complete
  res = await fetch(`${API_URL}/rental-requests/${reqId}/complete`, { method: 'POST', headers: { 'Cookie': tenantToken }});
  if (res.status !== 403) throw new Error('Tenant should not be able to complete');

  // Test: Other owner cannot complete
  res = await fetch(`${API_URL}/rental-requests/${reqId}/complete`, { method: 'POST', headers: { 'Cookie': otherOwnerToken }});
  if (res.status !== 403) throw new Error('Other owner should not be able to complete');

  // Owner completes
  res = await fetch(`${API_URL}/rental-requests/${reqId}/complete`, { method: 'POST', headers: { 'Cookie': ownerToken }});
  if (res.status !== 200) throw new Error('Owner failed to complete ACCEPTED request');

  // Test: Owner completes already completed
  res = await fetch(`${API_URL}/rental-requests/${reqId}/complete`, { method: 'POST', headers: { 'Cookie': ownerToken }});
  if (res.status !== 409) throw new Error('Should not complete already COMPLETED request');

  // Test: owner cannot review
  res = await fetch(`${API_URL}/properties/${propertyId}/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': ownerToken },
    body: JSON.stringify({ rentalRequestId: reqId, rating: 5, comment: 'Nice enough' })
  });
  if (res.status !== 403) throw new Error('Owner should not be able to review');

  // Test: other tenant cannot review
  res = await fetch(`${API_URL}/properties/${propertyId}/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': otherTenantToken },
    body: JSON.stringify({ rentalRequestId: reqId, rating: 5, comment: 'Nice enough' })
  });
  if (res.status !== 403) throw new Error('Other tenant should not be able to review someone else\'s request');

  // Create review
  res = await fetch(`${API_URL}/properties/${propertyId}/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ rentalRequestId: reqId, rating: 4, comment: 'Very clean', title: 'Great!' })
  });
  if (res.status !== 201) throw new Error('Tenant failed to create review');
  const reviewId = (await res.json()).data.id;

  // Duplicate review
  res = await fetch(`${API_URL}/properties/${propertyId}/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ rentalRequestId: reqId, rating: 5, comment: 'Nice enough' })
  });
  if (res.status !== 409) throw new Error('Should reject duplicate review');

  // Property aggregations
  res = await fetch(`${API_URL}/properties/${propertyId}`);
  let prop = (await res.json()).data;
  if (prop.averageRating !== 4 || prop.reviewCount !== 1) throw new Error('Aggregate mismatch');

  // Update review
  res = await fetch(`${API_URL}/reviews/${reviewId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': tenantToken },
    body: JSON.stringify({ rating: 5 })
  });
  if (res.status !== 200) throw new Error('Failed to update review');

  // Property aggregations after update
  res = await fetch(`${API_URL}/properties/${propertyId}`);
  prop = (await res.json()).data;
  if (prop.averageRating !== 5 || prop.reviewCount !== 1) throw new Error('Aggregate mismatch after update');

  // Delete review (other tenant)
  res = await fetch(`${API_URL}/reviews/${reviewId}`, { method: 'DELETE', headers: { 'Cookie': otherTenantToken } });
  if (res.status !== 403) throw new Error('Other tenant should not be able to delete');

  // Delete review
  res = await fetch(`${API_URL}/reviews/${reviewId}`, { method: 'DELETE', headers: { 'Cookie': tenantToken } });
  if (res.status !== 200) throw new Error('Failed to delete review');

  // Property aggregations after delete
  res = await fetch(`${API_URL}/properties/${propertyId}`);
  prop = (await res.json()).data;
  if (prop.averageRating !== 0 || prop.reviewCount !== 0) throw new Error('Aggregate mismatch after delete');

  console.log('--- ALL REVIEWS TESTS PASSED ---');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
