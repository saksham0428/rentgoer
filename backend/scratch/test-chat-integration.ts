import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { prisma } from '../src/lib/prisma';

dotenv.config();

const API_URL = 'http://localhost:5000/api';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function registerOrLogin(name: string, email: string, role: 'OWNER' | 'TENANT') {
  const password = 'Password123!';
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role })
  });

  const data = await res.json() as any;
  const cookies = res.headers.raw()['set-cookie'];
  const cookie = cookies ? cookies.map((c: string) => c.split(';')[0]).join('; ') : '';
  return { id: data.user?.id, email, cookie };
}

async function runChatIntegrationTests() {
  console.log('=== RUNNING CHAT INTEGRATION & CONVERSATION ID TESTS ===\n');

  const ts = Date.now();
  const owner = await registerOrLogin('Owner Test', `owner_${ts}@test.com`, 'OWNER');
  const tenant = await registerOrLogin('Tenant Test', `tenant_${ts}@test.com`, 'TENANT');

  // 1. Owner creates property
  console.log('1. Creating test property...');
  const propRes = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': owner.cookie },
    body: JSON.stringify({
      title: `Chat Test Property ${ts}`,
      description: 'A beautiful property to test chat',
      rent: 25000,
      city: 'Mumbai',
      locality: 'Bandra West',
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'APARTMENT',
      furnishedStatus: 'FURNISHED'
    })
  });
  const propData = await propRes.json() as any;
  assert(propRes.ok && propData.data?.id, 'Property created successfully');
  const propertyId = propData.data.id;

  // 2. Tenant creates rental request
  console.log('2. Tenant submits rental request...');
  const reqRes = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenant.cookie },
    body: JSON.stringify({
      message: 'Hi! I would love to rent this apartment. Is it available for immediate move-in?'
    })
  });
  const reqData = await reqRes.json() as any;
  assert(reqRes.ok && reqData.data?.id, 'Rental request submitted successfully');
  const requestId = reqData.data.id;

  // 3. Owner accepts rental request -> verify conversation is created and returned
  console.log('3. Owner accepts rental request...');
  const acceptRes = await fetch(`${API_URL}/rental-requests/${requestId}/accept`, {
    method: 'POST',
    headers: { 'Cookie': owner.cookie }
  });
  const acceptData = await acceptRes.json() as any;
  assert(acceptRes.ok, 'Accept request returned 200 OK');
  assert(acceptData.data?.status === 'ACCEPTED', 'Request status is ACCEPTED');
  assert(!!acceptData.data?.conversation?.id, 'acceptRequest response contains conversation with valid ID');
  const conversationId = acceptData.data.conversation.id;
  console.log(`  Conversation ID created: ${conversationId}`);

  // 4. Verify conversation ID is available in GET /rental-requests/me (Tenant)
  console.log('4. Verifying conversation ID is present in Tenant requests (/rental-requests/me)...');
  const tenantReqsRes = await fetch(`${API_URL}/rental-requests/me`, {
    headers: { 'Cookie': tenant.cookie }
  });
  const tenantReqsData = await tenantReqsRes.json() as any;
  assert(tenantReqsRes.ok, 'GET /rental-requests/me succeeded');
  const tenantReq = tenantReqsData.data.find((r: any) => r.id === requestId);
  assert(!!tenantReq, 'Request found in tenant requests list');
  assert(tenantReq.status === 'ACCEPTED', 'Tenant request is ACCEPTED');
  assert(tenantReq.conversation?.id === conversationId, 'conversation.id is present in tenant rental request object');

  // 5. Verify conversation ID is available in GET /rental-requests/owner (Owner)
  console.log('5. Verifying conversation ID is present in Owner requests (/rental-requests/owner)...');
  const ownerReqsRes = await fetch(`${API_URL}/rental-requests/owner`, {
    headers: { 'Cookie': owner.cookie }
  });
  const ownerReqsData = await ownerReqsRes.json() as any;
  assert(ownerReqsRes.ok, 'GET /rental-requests/owner succeeded');
  const ownerReq = ownerReqsData.data.find((r: any) => r.id === requestId);
  assert(!!ownerReq, 'Request found in owner requests list');
  assert(ownerReq.status === 'ACCEPTED', 'Owner request is ACCEPTED');
  assert(ownerReq.conversation?.id === conversationId, 'conversation.id is present in owner rental request object');

  // 6. Verify direct GET /conversations/:id
  console.log('6. Verifying direct GET /conversations/:id for tenant and owner...');
  const directConvRes = await fetch(`${API_URL}/conversations/${conversationId}`, {
    headers: { 'Cookie': tenant.cookie }
  });
  const directConvData = await directConvRes.json() as any;
  assert(directConvRes.ok, 'GET /conversations/:id returned 200 OK');
  assert(directConvData.data?.id === conversationId, 'Conversation ID matches');
  assert(directConvData.data?.property?.id === propertyId, 'Property details attached to conversation');
  assert(directConvData.data?.owner?.name === 'Owner Test', 'Owner details attached to conversation');
  assert(directConvData.data?.tenant?.name === 'Tenant Test', 'Tenant details attached to conversation');

  // 7. Verify conversation messages exchange (Tenant sends, Owner sends)
  console.log('7. Verifying message exchange between Tenant and Owner...');
  // Tenant sends message
  const msg1Res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenant.cookie },
    body: JSON.stringify({ content: 'Hello! Thank you for accepting my request.' })
  });
  const msg1Data = await msg1Res.json() as any;
  assert(msg1Res.status === 201, 'Tenant message sent with 201 Created');
  assert(msg1Data.data?.content === 'Hello! Thank you for accepting my request.', 'Tenant message content matches');

  // Owner sends reply
  const msg2Res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': owner.cookie },
    body: JSON.stringify({ content: 'Welcome! You can move in starting this Saturday.' })
  });
  const msg2Data = await msg2Res.json() as any;
  assert(msg2Res.status === 201, 'Owner reply sent with 201 Created');
  assert(msg2Data.data?.content === 'Welcome! You can move in starting this Saturday.', 'Owner reply content matches');

  // 8. Fetch message list and verify proper order and contents
  console.log('8. Verifying full message thread in GET /conversations/:id/messages...');
  const listMsgRes = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    headers: { 'Cookie': tenant.cookie }
  });
  const listMsgData = await listMsgRes.json() as any;
  assert(listMsgRes.ok, 'GET /conversations/:id/messages succeeded');
  assert(listMsgData.data.length === 2, 'Both messages returned in thread');
  assert(listMsgData.data[0].content === 'Hello! Thank you for accepting my request.', 'First message is tenant greeting');
  assert(listMsgData.data[1].content === 'Welcome! You can move in starting this Saturday.', 'Second message is owner response');

  // 9. Verify fallback idempotency endpoint POST /conversations
  console.log('9. Verifying POST /conversations fallback with { rentalRequestId } returns same conversation ID...');
  const fallbackRes = await fetch(`${API_URL}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenant.cookie },
    body: JSON.stringify({ rentalRequestId: requestId })
  });
  const fallbackData = await fallbackRes.json() as any;
  assert(fallbackRes.ok, 'POST /conversations returns 200 OK');
  assert(fallbackData.data?.id === conversationId, 'Returned conversation ID matches established ID');

  console.log('\n=======================================================');
  console.log('🎉 ALL CHAT INTEGRATION & CONVERSATION ID TESTS PASSED!');
  console.log('=======================================================\n');
}

runChatIntegrationTests()
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
