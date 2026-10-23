import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getTestPrismaClient,
  assertTestDatabaseSafety,
  ScopedTestContext,
  teardownTestDatabase,
} from '../helpers/test-db-context';

describe('Property & Rental Request PostgreSQL Integration Tests', () => {
  const { prisma } = getTestPrismaClient();
  const context = new ScopedTestContext(prisma);

  let ownerId: string;
  let tenantId: string;
  let propertyId: string;
  let rentalRequestId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Assert loopback and rentgoer_test database safety before running test
    const identity = await assertTestDatabaseSafety(prisma);
    expect(identity.currentDatabase).toBe('rentgoer_test');
  });

  afterAll(async () => {
    await context.cleanup();
    await teardownTestDatabase();
  });

  it('creates owner and property in PostgreSQL database', async () => {
    const ts = Date.now();
    const owner = await prisma.user.create({
      data: {
        name: 'Integration Owner',
        email: `owner_${ts}@test.com`,
        passwordHash: '$2b$10$dummyHashOwner123456789012345',
        role: 'OWNER',
      },
    });
    ownerId = owner.id;
    context.trackUser(owner.id);

    const property = await prisma.property.create({
      data: {
        ownerId: owner.id,
        title: `Integration Test Apartment ${ts}`,
        description: 'Prime 2BHK apartment in Bandra West for integration testing',
        rent: 45000,
        securityDeposit: 90000,
        city: 'Mumbai',
        locality: 'Bandra West',
        address: '101 Sea Breeze Apt, Carter Road',
        bedrooms: 2,
        bathrooms: 2,
        propertyType: 'APARTMENT',
        furnishedStatus: 'FURNISHED',
        availableFrom: new Date(),
        isAvailable: true,
      },
    });
    propertyId = property.id;
    context.trackProperty(property.id);

    expect(property.id).toBeDefined();
    expect(property.ownerId).toBe(ownerId);
    expect(property.rent).toBe(45000);
    expect(property.isAvailable).toBe(true);
  });

  it('tenant submits rental request for available property', async () => {
    const ts = Date.now();
    const tenant = await prisma.user.create({
      data: {
        name: 'Integration Tenant',
        email: `tenant_${ts}@test.com`,
        passwordHash: '$2b$10$dummyHashTenant12345678901234',
        role: 'TENANT',
      },
    });
    tenantId = tenant.id;
    context.trackUser(tenant.id);

    const rentalRequest = await prisma.rentalRequest.create({
      data: {
        propertyId,
        tenantId,
        message: 'Hello, I am interested in renting this property. Please let me know if available.',
        status: 'PENDING',
      },
    });
    rentalRequestId = rentalRequest.id;
    context.trackRentalRequest(rentalRequest.id);

    expect(rentalRequest.id).toBeDefined();
    expect(rentalRequest.status).toBe('PENDING');
    expect(rentalRequest.propertyId).toBe(propertyId);
    expect(rentalRequest.tenantId).toBe(tenantId);
  });

  it('owner accepts rental request, marking property unavailable and establishing conversation', async () => {
    // Atomic acceptance transaction: update request, update property, create conversation
    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.rentalRequest.update({
        where: { id: rentalRequestId },
        data: { status: 'ACCEPTED' },
      });

      await tx.property.update({
        where: { id: propertyId },
        data: { isAvailable: false },
      });

      const conv = await tx.conversation.create({
        data: {
          rentalRequestId,
          propertyId,
          tenantId,
          ownerId,
        },
      });

      return { updatedRequest, conversation: conv };
    });

    conversationId = result.conversation.id;
    context.trackConversation(conversationId);

    expect(result.updatedRequest.status).toBe('ACCEPTED');
    expect(result.conversation.rentalRequestId).toBe(rentalRequestId);

    // Verify property availability updated in database
    const checkProperty = await prisma.property.findUnique({ where: { id: propertyId } });
    expect(checkProperty?.isAvailable).toBe(false);
  });

  it('tenant can exchange messages with owner within accepted conversation', async () => {
    const tenantMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId: tenantId,
        content: 'Thank you for accepting! When can I collect the keys?',
      },
    });

    const ownerReply = await prisma.message.create({
      data: {
        conversationId,
        senderId: ownerId,
        content: 'You can collect the keys this Saturday at 11 AM.',
      },
    });

    const thread = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    expect(thread).toHaveLength(2);
    expect(thread[0].id).toBe(tenantMessage.id);
    expect(thread[0].senderId).toBe(tenantId);
    expect(thread[1].id).toBe(ownerReply.id);
    expect(thread[1].senderId).toBe(ownerId);
  });

  it('retrieves joined conversation with property and participant relations', async () => {
    const joinedConversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        property: { select: { id: true, title: true, rent: true } },
        tenant: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
        rentalRequest: { select: { id: true, status: true } },
        messages: { select: { id: true, content: true } },
      },
    });

    expect(joinedConversation).not.toBeNull();
    expect(joinedConversation?.property.id).toBe(propertyId);
    expect(joinedConversation?.tenant.id).toBe(tenantId);
    expect(joinedConversation?.owner.id).toBe(ownerId);
    expect(joinedConversation?.rentalRequest?.status).toBe('ACCEPTED');
    expect(joinedConversation?.messages).toHaveLength(2);
  });
});
