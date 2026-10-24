import { test, expect } from './fixtures';
import { TestFixtureManager, TestUser, TestProperty } from './helpers/test-fixtures';

test.describe('Tenant-to-Owner Rental Request Lifecycle (Full-Stack)', () => {
  test.use({ fullStack: true });

  const fixtureManager = new TestFixtureManager('http://127.0.0.1:5001');
  let owner: TestUser;
  let tenant: TestUser;
  let propertyAccept: TestProperty;
  let propertyReject: TestProperty;

  test.beforeAll(async () => {
    // Register deterministic test users and create test properties via verified test backend
    owner = await fixtureManager.registerUser('OWNER', 'OwnerLifecycle');
    tenant = await fixtureManager.registerUser('TENANT', 'TenantLifecycle');
    propertyAccept = await fixtureManager.createProperty(owner, 'Luxury Studio Bandra');
    propertyReject = await fixtureManager.createProperty(owner, 'Cozy Flat Juhu');
  });

  test.afterAll(async () => {
    // Non-destructive scoped cleanup of only records created during this test run
    await fixtureManager.cleanup();
  });

  test('tenant submits rental request, owner accepts, and status updates to ACCEPTED', async ({ page }) => {
    // 1. Tenant logs in
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.fill('input#email', tenant.email);
    await page.fill('input#password', tenant.password);
    await page.click('button[type="submit"]:has-text("Log in")');

    // Tenant is redirected to /properties
    await page.waitForURL('**/properties');

    // 2. Tenant discovers the test property on /properties
    const propertyCard = page.locator(`a[href="/properties/${propertyAccept.id}"]`);
    await expect(propertyCard).toBeVisible({ timeout: 10000 });
    await expect(propertyCard.getByText(propertyAccept.title)).toBeVisible();
    await propertyCard.click();

    // 3. Tenant views property details and submits rental request
    await page.waitForURL(`**/properties/${propertyAccept.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(propertyAccept.title) })
    ).toBeVisible();

    const requestForm = page.locator('form:has-text("Send Rental Request")');
    await expect(requestForm).toBeVisible();
    await page.fill(
      'textarea#message',
      'Hi, I would love to rent this apartment. We can sign the lease immediately.'
    );
    await page.click('button[type="submit"]:has-text("Send Rental Request")');

    // Observable UI state shows "Request Pending"
    await expect(page.getByText('Request Pending')).toBeVisible({ timeout: 10000 });

    // 4. Tenant verifies request is visible on /rental-requests
    await page.goto('/rental-requests');
    await expect(page.getByRole('heading', { name: 'My Rental Requests' })).toBeVisible();
    const tenantRequestCard = page.locator(`div:has-text("${propertyAccept.title}")`).first();
    await expect(tenantRequestCard).toBeVisible();
    await expect(tenantRequestCard.getByText('PENDING', { exact: true })).toBeVisible();

    // 5. Switch to Owner: Clear session cookies and log in as owner
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input#email', owner.email);
    await page.fill('input#password', owner.password);
    await page.click('button[type="submit"]:has-text("Log in")');
    await page.waitForURL('**/owner');

    // 6. Owner views incoming requests on /owner/requests
    await page.goto('/owner/requests');
    await expect(page.getByRole('heading', { name: 'Rental Requests' })).toBeVisible();

    const ownerCard = page
      .locator(`div:has-text("${propertyAccept.title}")`)
      .filter({ hasText: tenant.name })
      .first();
    await expect(ownerCard).toBeVisible({ timeout: 10000 });
    await expect(ownerCard.getByText('PENDING', { exact: true })).toBeVisible();

    // 7. Owner accepts the request (handling browser confirmation dialog)
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await ownerCard.locator('button:has-text("Accept")').click();

    // Observable UI state on Owner dashboard updates to ACCEPTED
    await expect(ownerCard.locator('text=Request Accepted')).toBeVisible({ timeout: 10000 });
    await expect(ownerCard.getByText('ACCEPTED', { exact: true })).toBeVisible();

    // 8. Tenant verifies status is now ACCEPTED
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input#email', tenant.email);
    await page.fill('input#password', tenant.password);
    await page.click('button[type="submit"]:has-text("Log in")');
    await page.waitForURL('**/properties');

    await page.goto('/rental-requests');
    const updatedTenantCard = page.locator(`div:has-text("${propertyAccept.title}")`).first();
    await expect(updatedTenantCard.getByText('ACCEPTED', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(updatedTenantCard.locator('button:has-text("Chat with Owner")')).toBeVisible();

    // Also verify property page reflects updated availability
    await page.goto(`/properties/${propertyAccept.id}`);
    await expect(page.getByRole('heading', { name: 'Unavailable' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Rented', { exact: true }).first()).toBeVisible();
  });

  test('tenant submits rental request, owner rejects, and status updates to REJECTED', async ({ page }) => {
    // 1. Tenant logs in
    await page.goto('/login');
    await page.fill('input#email', tenant.email);
    await page.fill('input#password', tenant.password);
    await page.click('button[type="submit"]:has-text("Log in")');
    await page.waitForURL('**/properties');

    // 2. Tenant discovers and navigates to the 2nd test property
    await page.goto(`/properties/${propertyReject.id}`);
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(propertyReject.title) })
    ).toBeVisible();

    // 3. Tenant submits request
    await page.fill('textarea#message', 'Hello, inquiring about moving in next month for this flat.');
    await page.click('button[type="submit"]:has-text("Send Rental Request")');
    await expect(page.getByText('Request Pending')).toBeVisible({ timeout: 10000 });

    // 4. Switch to Owner
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input#email', owner.email);
    await page.fill('input#password', owner.password);
    await page.click('button[type="submit"]:has-text("Log in")');
    await page.waitForURL('**/owner');

    // 5. Owner navigates to /owner/requests and finds the request
    await page.goto('/owner/requests');
    await expect(page.getByRole('heading', { name: 'Rental Requests' })).toBeVisible();

    const ownerCard = page
      .locator(`div:has-text("${propertyReject.title}")`)
      .filter({ hasText: tenant.name })
      .first();
    await expect(ownerCard).toBeVisible({ timeout: 10000 });

    // 6. Owner rejects the request (handling browser confirmation dialog)
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await ownerCard.locator('button:has-text("Reject")').click();

    // Observable UI state on Owner dashboard updates to REJECTED
    await expect(ownerCard.locator('text=Request Rejected')).toBeVisible({ timeout: 10000 });
    await expect(ownerCard.getByText('REJECTED', { exact: true })).toBeVisible();

    // 7. Tenant verifies updated status is REJECTED on /rental-requests
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input#email', tenant.email);
    await page.fill('input#password', tenant.password);
    await page.click('button[type="submit"]:has-text("Log in")');
    await page.waitForURL('**/properties');

    await page.goto('/rental-requests');
    const updatedTenantCard = page.locator(`div:has-text("${propertyReject.title}")`).first();
    await expect(updatedTenantCard.getByText('REJECTED', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
