import fetch from 'node-fetch';
import { prisma } from '../src/lib/prisma';

const API_URL = 'http://localhost:5000/api';

async function generateUser(role: 'OWNER' | 'TENANT', prefix: string) {
  const timestamp = Date.now() + Math.floor(Math.random() * 100000);
  const email = `${prefix}_${timestamp}@test.com`;
  const password = 'Password123!';
  
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${prefix} User`, email, password, role })
  });

  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(`Failed to register ${role} (${prefix}): ${JSON.stringify(data)}`);
  }

  const cookies = res.headers.raw()['set-cookie'];
  const cookie = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
  return { id: data.user.id, email, cookie };
}

async function createProperty(ownerCookie: string, title: string) {
  const res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
    body: JSON.stringify({
      title,
      description: 'Test Property Description',
      rent: 1500,
      city: 'Mumbai',
      locality: 'Bandra',
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'APARTMENT',
      furnishedStatus: 'FURNISHED'
    })
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(`Failed to create property: ${JSON.stringify(data)}`);
  }
  return data.data.id as string;
}

async function createRentalRequest(tenantCookie: string, propertyId: string, message: string) {
  const res = await fetch(`${API_URL}/properties/${propertyId}/rental-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tenantCookie },
    body: JSON.stringify({ message })
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(`Failed to create rental request: ${JSON.stringify(data)}`);
  }
  return data.data.id as string;
}

async function runIssue1RegressionTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING ISSUE 1 REGRESSION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // =========================================================================
  // TEST GROUP 1: Standard Acceptance, Rejection of Other Requests, One Conversation
  // =========================================================================
  console.log('--- TEST GROUP 1: Accept Request, Reject Others, Exactly One Conversation ---');
  {
    const owner = await generateUser('OWNER', 'owner_g1');
    const tenantA = await generateUser('TENANT', 'tenant_g1_a');
    const tenantB = await generateUser('TENANT', 'tenant_g1_b');
    const tenantC = await generateUser('TENANT', 'tenant_g1_c');

    const propertyId = await createProperty(owner.cookie, 'Property Suite 1');
    const reqAId = await createRentalRequest(tenantA.cookie, propertyId, 'Tenant A Request');
    const reqBId = await createRentalRequest(tenantB.cookie, propertyId, 'Tenant B Request');
    const reqCId = await createRentalRequest(tenantC.cookie, propertyId, 'Tenant C Request');

    // Owner accepts Tenant A's request
    const acceptRes = await fetch(`${API_URL}/rental-requests/${reqAId}/accept`, {
      method: 'POST',
      headers: { 'Cookie': owner.cookie }
    });
    const acceptData = await acceptRes.json() as any;

    assert(acceptRes.status === 200, 'Accept request returns HTTP 200 OK', `Status: ${acceptRes.status}`);
    assert(acceptData.success === true, 'Accept request response success is true');
    assert(acceptData.data.status === 'ACCEPTED', 'Response data status is ACCEPTED');

    // Verify database state for the accepted request
    const dbReqA = await prisma.rentalRequest.findUnique({ where: { id: reqAId } });
    assert(dbReqA?.status === 'ACCEPTED', 'Accepted request status is ACCEPTED in DB');

    // Verify property availability
    const dbProperty = await prisma.property.findUnique({ where: { id: propertyId } });
    assert(dbProperty?.isAvailable === false, 'Property is marked unavailable (isAvailable: false) in DB');

    // Verify other pending requests are rejected
    const dbReqB = await prisma.rentalRequest.findUnique({ where: { id: reqBId } });
    const dbReqC = await prisma.rentalRequest.findUnique({ where: { id: reqCId } });
    assert(dbReqB?.status === 'REJECTED', 'Other pending request B is REJECTED in DB');
    assert(dbReqC?.status === 'REJECTED', 'Other pending request C is REJECTED in DB');

    // Verify exactly one conversation exists for the accepted request
    const conversationsForReqA = await prisma.conversation.findMany({
      where: { rentalRequestId: reqAId }
    });
    assert(conversationsForReqA.length === 1, 'Exactly one conversation created for accepted request A');
    assert(conversationsForReqA[0].propertyId === propertyId, 'Conversation belongs to correct property');
    assert(conversationsForReqA[0].tenantId === tenantA.id, 'Conversation has correct tenant');
    assert(conversationsForReqA[0].ownerId === owner.id, 'Conversation has correct owner');

    // Verify rejected requests have zero conversations
    const conversationsForReqB = await prisma.conversation.count({ where: { rentalRequestId: reqBId } });
    const conversationsForReqC = await prisma.conversation.count({ where: { rentalRequestId: reqCId } });
    assert(conversationsForReqB === 0, 'No conversation created for rejected request B');
    assert(conversationsForReqC === 0, 'No conversation created for rejected request C');

    // Verify notifications created
    const notifTenantA = await prisma.notification.findFirst({
      where: { userId: tenantA.id, type: 'REQUEST_ACCEPTED', referenceId: reqAId }
    });
    assert(!!notifTenantA, 'Notification REQUEST_ACCEPTED created for tenant A');

    const notifTenantB = await prisma.notification.findFirst({
      where: { userId: tenantB.id, type: 'REQUEST_REJECTED', referenceId: reqBId }
    });
    const notifTenantC = await prisma.notification.findFirst({
      where: { userId: tenantC.id, type: 'REQUEST_REJECTED', referenceId: reqCId }
    });
    assert(!!notifTenantB, 'Notification REQUEST_REJECTED created for tenant B');
    assert(!!notifTenantC, 'Notification REQUEST_REJECTED created for tenant C');
  }

  // =========================================================================
  // TEST GROUP 2: Concurrent Acceptance of the SAME Request (Double-Click Race)
  // =========================================================================
  console.log('\n--- TEST GROUP 2: Concurrent Acceptance of the SAME Request ---');
  {
    const owner = await generateUser('OWNER', 'owner_g2');
    const tenant = await generateUser('TENANT', 'tenant_g2');
    const propertyId = await createProperty(owner.cookie, 'Property Suite 2 (Concurrent Same)');
    const reqId = await createRentalRequest(tenant.cookie, propertyId, 'Single Request for Race');

    // Fire two accept requests concurrently
    const [res1, res2] = await Promise.all([
      fetch(`${API_URL}/rental-requests/${reqId}/accept`, {
        method: 'POST',
        headers: { 'Cookie': owner.cookie }
      }),
      fetch(`${API_URL}/rental-requests/${reqId}/accept`, {
        method: 'POST',
        headers: { 'Cookie': owner.cookie }
      })
    ]);

    const statuses = [res1.status, res2.status].sort();
    console.log(`    Concurrent statuses received: [${res1.status}, ${res2.status}]`);

    // One must be 200, the other must be 409 Conflict (NOT 500!)
    assert(
      statuses[0] === 200 && statuses[1] === 409,
      'Exactly one concurrent request succeeds (200) and the other fails safely with 409 Conflict',
      `Statuses: [${statuses.join(', ')}]`
    );

    // Verify exactly ONE conversation was created in DB
    const totalConversations = await prisma.conversation.count({
      where: { rentalRequestId: reqId }
    });
    assert(totalConversations === 1, 'Exactly one conversation exists in DB after concurrent requests');

    // Verify DB state
    const dbReq = await prisma.rentalRequest.findUnique({ where: { id: reqId } });
    assert(dbReq?.status === 'ACCEPTED', 'Request is ACCEPTED in DB');
  }

  // =========================================================================
  // TEST GROUP 3: Concurrent Acceptance of TWO DIFFERENT Requests for Same Property
  // =========================================================================
  console.log('\n--- TEST GROUP 3: Concurrent Acceptance of TWO DIFFERENT Requests for Same Property ---');
  {
    const owner = await generateUser('OWNER', 'owner_g3');
    const tenant1 = await generateUser('TENANT', 'tenant_g3_1');
    const tenant2 = await generateUser('TENANT', 'tenant_g3_2');
    const propertyId = await createProperty(owner.cookie, 'Property Suite 3 (Concurrent Different)');
    const req1Id = await createRentalRequest(tenant1.cookie, propertyId, 'Interested in renting unit 1');
    const req2Id = await createRentalRequest(tenant2.cookie, propertyId, 'Interested in renting unit 2');

    // Fire two accept requests concurrently on different requests of the same property
    const [res1, res2] = await Promise.all([
      fetch(`${API_URL}/rental-requests/${req1Id}/accept`, {
        method: 'POST',
        headers: { 'Cookie': owner.cookie }
      }),
      fetch(`${API_URL}/rental-requests/${req2Id}/accept`, {
        method: 'POST',
        headers: { 'Cookie': owner.cookie }
      })
    ]);

    const statuses = [res1.status, res2.status].sort();
    console.log(`    Concurrent cross-request statuses received: [${res1.status}, ${res2.status}]`);

    // Exactly one must succeed (200) and the other must be 409 Conflict (NOT 500!)
    assert(
      statuses[0] === 200 && statuses[1] === 409,
      'Only one request wins (200) and the conflicting request is rejected with 409 Conflict',
      `Statuses: [${statuses.join(', ')}]`
    );

    // Verify DB state: exactly one request ACCEPTED, the other REJECTED
    const dbReq1 = await prisma.rentalRequest.findUnique({ where: { id: req1Id } });
    const dbReq2 = await prisma.rentalRequest.findUnique({ where: { id: req2Id } });

    const acceptedCount = [dbReq1?.status, dbReq2?.status].filter(s => s === 'ACCEPTED').length;
    const rejectedCount = [dbReq1?.status, dbReq2?.status].filter(s => s === 'REJECTED').length;

    assert(acceptedCount === 1, 'Exactly one request is ACCEPTED in DB');
    assert(rejectedCount === 1, 'The losing request is REJECTED in DB');

    // Verify property availability
    const dbProperty = await prisma.property.findUnique({ where: { id: propertyId } });
    assert(dbProperty?.isAvailable === false, 'Property is marked unavailable (isAvailable: false)');

    // Verify conversations: exactly ONE conversation exists for the entire property
    const propConversations = await prisma.conversation.count({
      where: { propertyId }
    });
    assert(propConversations === 1, 'Exactly one conversation exists for the property');
  }

  // =========================================================================
  // TEST GROUP 4: Batch Notification and Many Pending Requests (Timeout Prevention)
  // =========================================================================
  console.log('\n--- TEST GROUP 4: Batch Notification Insert with Many Pending Requests ---');
  {
    const owner = await generateUser('OWNER', 'owner_g4');
    const propertyId = await createProperty(owner.cookie, 'Property Suite 4 (Batch Stress)');
    
    // Create 6 pending requests
    const tenantIds: string[] = [];
    const requestIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const t = await generateUser('TENANT', `tenant_g4_${i}`);
      tenantIds.push(t.id);
      const reqId = await createRentalRequest(t.cookie, propertyId, `Bulk Request ${i}`);
      requestIds.push(reqId);
    }

    const startTime = Date.now();
    const acceptRes = await fetch(`${API_URL}/rental-requests/${requestIds[0]}/accept`, {
      method: 'POST',
      headers: { 'Cookie': owner.cookie }
    });
    const duration = Date.now() - startTime;
    console.log(`    Acceptance completed in ${duration}ms`);

    assert(acceptRes.status === 200, 'Acceptance with multiple pending requests succeeds with 200 OK');
    assert(duration < 5000, 'Transaction completed well within timeout limits');

    // Verify all other 5 requests became REJECTED
    const otherReqsInDb = await prisma.rentalRequest.findMany({
      where: { id: { in: requestIds.slice(1) } }
    });
    assert(
      otherReqsInDb.every(r => r.status === 'REJECTED'),
      'All other 5 pending requests were updated to REJECTED'
    );

    // Verify rejected notifications created
    const rejectedNotifs = await prisma.notification.findMany({
      where: { referenceId: { in: requestIds.slice(1) }, type: 'REQUEST_REJECTED' }
    });
    assert(rejectedNotifs.length === 5, 'Notifications created for all 5 rejected tenants');
  }

  // =========================================================================
  // TEST GROUP 5: Invalid Transitions & Edge Cases
  // =========================================================================
  console.log('\n--- TEST GROUP 5: Invalid State Transitions Return 409 ---');
  {
    const owner = await generateUser('OWNER', 'owner_g5');
    const tenant1 = await generateUser('TENANT', 'tenant_g5_1');
    const tenant2 = await generateUser('TENANT', 'tenant_g5_2');
    const propertyId = await createProperty(owner.cookie, 'Property Suite 5');
    const req1Id = await createRentalRequest(tenant1.cookie, propertyId, 'Interested in renting unit 1');
    const req2Id = await createRentalRequest(tenant2.cookie, propertyId, 'Interested in renting unit 2');

    // Accept request 1
    await fetch(`${API_URL}/rental-requests/${req1Id}/accept`, {
      method: 'POST',
      headers: { 'Cookie': owner.cookie }
    });

    // Re-accepting already ACCEPTED request -> 409
    const reAcceptRes = await fetch(`${API_URL}/rental-requests/${req1Id}/accept`, {
      method: 'POST',
      headers: { 'Cookie': owner.cookie }
    });
    assert(reAcceptRes.status === 409, 'Re-accepting an already ACCEPTED request returns 409 Conflict');

    // Accepting an already REJECTED request -> 409
    const acceptRejectedRes = await fetch(`${API_URL}/rental-requests/${req2Id}/accept`, {
      method: 'POST',
      headers: { 'Cookie': owner.cookie }
    });
    assert(acceptRejectedRes.status === 409, 'Accepting an already REJECTED request returns 409 Conflict');
  }

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} REGRESSION TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runIssue1RegressionTests()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
