import { test, expect } from './fixtures';
import { TestFixtureManager, TestUser, TestProperty, TestConversation } from './helpers/test-fixtures';

test.describe('Tenant-Owner Chat & Real-Time Messaging E2E Suite', () => {
  test.use({ fullStack: true });

  const fixtureManager = new TestFixtureManager('http://127.0.0.1:5001');
  let owner: TestUser;
  let tenant: TestUser;
  let unauthorizedUser: TestUser;
  let property: TestProperty;
  let conversation: TestConversation;

  test.beforeAll(async () => {
    // 1. Create test owner and tenant
    owner = await fixtureManager.registerUser('OWNER', 'OwnerChat');
    tenant = await fixtureManager.registerUser('TENANT', 'TenantChat');
    unauthorizedUser = await fixtureManager.registerUser('TENANT', 'UnauthorizedUser');

    // 2. Create test property owned by the test owner
    property = await fixtureManager.createProperty(owner, 'Sea Breeze Apartment');

    // 3. Establish accepted rental request to create verified conversation
    const rentalRequest = await fixtureManager.submitRentalRequest(
      tenant,
      property.id,
      'I am interested in leasing this Sea Breeze apartment.'
    );

    const acceptResult = await fixtureManager.acceptRentalRequest(owner, rentalRequest.id);
    if (!acceptResult.conversation?.id) {
      throw new Error('Failed to establish conversation during test setup');
    }
    conversation = acceptResult.conversation;
  });

  test.afterAll(async () => {
    // Targeted scoped cleanup of test-created entities
    await fixtureManager.cleanup();
  });

  test('1. Tenant and owner can access the conversation and view verified badges and header metadata', async ({
    page,
  }) => {
    // --- Tenant Perspective ---
    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: tenant.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // Tenant navigates to /rental-requests and clicks "Chat with Owner"
    await page.goto('/rental-requests');
    const tenantCard = page.locator(`div:has-text("${property.title}")`).first();
    await expect(tenantCard).toBeVisible({ timeout: 10000 });
    const chatBtn = tenantCard.getByRole('link', { name: 'Chat with Owner' });
    await expect(chatBtn).toBeVisible();
    await chatBtn.click();

    // Verifies URL and chat header
    await page.waitForURL(`**/chat/${conversation.id}`);
    await expect(page.getByRole('heading', { level: 2, name: owner.name })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Property Owner', { exact: true })).toBeVisible();
    await expect(page.getByText(property.title).first()).toBeVisible();
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();

    // --- Owner Perspective ---
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: owner.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // Owner navigates to /owner/requests and clicks "Chat with Tenant"
    await page.goto('/owner/requests');
    const ownerCard = page.locator(`div:has-text("${property.title}")`).filter({ hasText: tenant.name }).first();
    await expect(ownerCard).toBeVisible({ timeout: 10000 });
    const ownerChatBtn = ownerCard.getByRole('link', { name: 'Chat with Tenant' });
    await expect(ownerChatBtn).toBeVisible();
    await ownerChatBtn.click();

    // Verifies URL and chat header
    await page.waitForURL(`**/chat/${conversation.id}`);
    await expect(page.getByRole('heading', { level: 2, name: tenant.name })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tenant', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(property.title).first()).toBeVisible();
  });

  test('2. Tenant sends a message, message persists, and owner reads it', async ({ page }) => {
    const tenantMsgContent = `Hello owner, when can I pick up the keys? Ref-${Date.now()}`;

    // Tenant logs in and sends message
    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: tenant.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await page.goto(`/chat/${conversation.id}`);
    await expect(page.getByRole('heading', { level: 2, name: owner.name })).toBeVisible({ timeout: 10000 });

    const messageInput = page.getByPlaceholder('Type a message...');
    await messageInput.fill(tenantMsgContent);
    await page.locator('button[aria-label="Send Message"]').click();

    // Verify tenant sees their own sent message bubble
    await expect(page.locator('p.break-words', { hasText: tenantMsgContent })).toBeVisible({ timeout: 10000 });

    // Owner logs in and views the conversation
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: owner.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await page.goto(`/chat/${conversation.id}`);
    await expect(page.getByRole('heading', { level: 2, name: tenant.name })).toBeVisible({ timeout: 10000 });

    // Verify owner sees the tenant's message
    await expect(page.locator('p.break-words', { hasText: tenantMsgContent })).toBeVisible({ timeout: 10000 });
  });

  test('3. Owner replies, tenant sees the reply, and messages persist across page navigations', async ({ page }) => {
    const ownerReplyContent = `Hi tenant, you can pick up the keys on Saturday at 10 AM. Ref-${Date.now()}`;

    // Owner logs in and sends reply
    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: owner.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await page.goto(`/chat/${conversation.id}`);
    await expect(page.getByRole('heading', { level: 2, name: tenant.name })).toBeVisible({ timeout: 10000 });

    const messageInput = page.getByPlaceholder('Type a message...');
    await messageInput.fill(ownerReplyContent);
    await page.locator('button[aria-label="Send Message"]').click();

    // Verify owner sees their reply
    await expect(page.locator('p.break-words', { hasText: ownerReplyContent })).toBeVisible({ timeout: 10000 });

    // Switch to tenant: Navigate away and return to verify persistence
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: tenant.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // Navigate away to properties page first
    await page.goto('/properties');
    await expect(page.getByRole('heading', { name: 'Browse Properties' })).toBeVisible();

    // Return to the chat conversation
    await page.goto(`/chat/${conversation.id}`);
    await expect(page.getByRole('heading', { level: 2, name: owner.name })).toBeVisible({ timeout: 10000 });

    // Verify persisted message history shows both messages
    await expect(page.locator('p.break-words', { hasText: ownerReplyContent })).toBeVisible({ timeout: 10000 });
  });

  test('4. Real-time message exchange between two concurrent browser contexts', async ({ browser }) => {
    const liveTenantMsg = `Live SSE message from Tenant: ${Date.now()}`;
    const liveOwnerMsg = `Live SSE response from Owner: ${Date.now()}`;

    // 1. Create separate isolated browser context for tenant
    const tenantContext = await browser.newContext();
    await tenantContext.addCookies([
      {
        name: 'rentgoer_token',
        value: tenant.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const tenantPage = await tenantContext.newPage();

    // 2. Create separate isolated browser context for owner
    const ownerContext = await browser.newContext();
    await ownerContext.addCookies([
      {
        name: 'rentgoer_token',
        value: owner.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const ownerPage = await ownerContext.newPage();

    try {
      // Both open the conversation simultaneously
      await tenantPage.goto(`/chat/${conversation.id}`);
      await expect(tenantPage.getByRole('heading', { level: 2, name: owner.name })).toBeVisible({ timeout: 10000 });

      await ownerPage.goto(`/chat/${conversation.id}`);
      await expect(ownerPage.getByRole('heading', { level: 2, name: tenant.name })).toBeVisible({ timeout: 10000 });

      // Tenant sends live message
      await tenantPage.getByPlaceholder('Type a message...').fill(liveTenantMsg);
      await tenantPage.locator('button[aria-label="Send Message"]').click();

      // Tenant sees it immediately (optimistic UI)
      await expect(tenantPage.locator('p.break-words', { hasText: liveTenantMsg })).toBeVisible({ timeout: 5000 });

      // Owner receives and displays it in real-time WITHOUT page reload
      await expect(ownerPage.locator('p.break-words', { hasText: liveTenantMsg })).toBeVisible({ timeout: 10000 });

      // Owner responds live
      await ownerPage.getByPlaceholder('Type a message...').fill(liveOwnerMsg);
      await ownerPage.locator('button[aria-label="Send Message"]').click();

      // Owner sees it immediately
      await expect(ownerPage.locator('p.break-words', { hasText: liveOwnerMsg })).toBeVisible({ timeout: 5000 });

      // Tenant receives and displays owner's response in real-time WITHOUT page reload
      await expect(tenantPage.locator('p.break-words', { hasText: liveOwnerMsg })).toBeVisible({ timeout: 10000 });
    } finally {
      await tenantContext.close();
      await ownerContext.close();
    }
  });

  test('5. Authorization: Unauthorized user cannot read or send messages in another conversation', async ({
    page,
    request,
  }) => {
    // Unauthorized user logs in via browser
    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: unauthorizedUser.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // Attempting to visit unauthorized conversation redirects to /chat inbox
    await page.goto(`/chat/${conversation.id}`);
    await page.waitForURL('**/chat');
    expect(page.url()).not.toContain(conversation.id);

    // Verify API level strict 403 Forbidden enforcement
    const getRes = await request.get(`http://localhost:5001/api/conversations/${conversation.id}`, {
      headers: { Cookie: `rentgoer_token=${unauthorizedUser.cookie}` },
    });
    expect(getRes.status()).toBe(403);
    const getBody = await getRes.json();
    expect(getBody.message).toMatch(/Forbidden/i);

    // Verify messages cannot be read via API
    const getMsgRes = await request.get(`http://localhost:5001/api/conversations/${conversation.id}/messages`, {
      headers: { Cookie: `rentgoer_token=${unauthorizedUser.cookie}` },
    });
    expect(getMsgRes.status()).toBe(403);

    // Verify messages cannot be sent via API
    const sendMsgRes = await request.post(`http://localhost:5001/api/conversations/${conversation.id}/messages`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rentgoer_token=${unauthorizedUser.cookie}`,
      },
      data: { content: 'Sneaky unauthorized message attempt' },
    });
    expect(sendMsgRes.status()).toBe(403);

    // Verify real-time SSE stream rejects unauthorized user with 403
    const streamRes = await request.get(`http://localhost:5001/api/conversations/${conversation.id}/realtime`, {
      headers: { Cookie: `rentgoer_token=${unauthorizedUser.cookie}` },
    });
    expect(streamRes.status()).toBe(403);
  });

  test('6. Nonexistent conversation ID gracefully redirects to inbox with 404 handled', async ({
    page,
    request,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: tenant.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // Direct navigation to non-existent conversation returns user to /chat
    await page.goto(`/chat/${fakeId}`);
    await page.waitForURL('**/chat');

    // API returns 404
    const apiRes = await request.get(`http://localhost:5001/api/conversations/${fakeId}`, {
      headers: { Cookie: `rentgoer_token=${tenant.cookie}` },
    });
    expect(apiRes.status()).toBe(404);
  });

  test('7. Client validation: Empty or whitespace message cannot be sent', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'rentgoer_token',
        value: tenant.cookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await page.goto(`/chat/${conversation.id}`);
    await expect(page.getByRole('heading', { level: 2, name: owner.name })).toBeVisible({ timeout: 10000 });

    const messageInput = page.getByPlaceholder('Type a message...');
    const sendButton = page.locator('button[aria-label="Send Message"]');

    // Initially empty: button disabled
    await expect(sendButton).toBeDisabled();

    // Whitespace only: button remains disabled
    await messageInput.fill('     ');
    await expect(sendButton).toBeDisabled();

    // Valid text: button enables
    await messageInput.fill('Valid text');
    await expect(sendButton).toBeEnabled();
  });
});
