import { test, expect, mockOwnerSession, mockTenantSession, MOCK_OWNER_USER } from './fixtures';

test.describe('Authenticated E2E Suite: Owner Property Creation & Tenant Saved Properties', () => {
  // ==========================================
  // OWNER SCENARIOS
  // ==========================================
  test.describe('Owner Scenarios', () => {
    test('1. Owner dashboard loads with mocked properties and stats', async ({ page }) => {
      await mockOwnerSession(page);

      // Mock owner listings and verification endpoints
      await page.route('**/api/**/properties/owner/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'owner-prop-1',
                title: 'Bandra Luxury Apartment',
                city: 'Mumbai',
                locality: 'Bandra West',
                rent: 75000,
                bedrooms: 2,
                bathrooms: 2,
                propertyType: 'APARTMENT',
                furnishedStatus: 'FURNISHED',
                isAvailable: true,
                isVerified: true,
                images: [],
              },
              {
                id: 'owner-prop-2',
                title: 'Indiranagar Independent House',
                city: 'Bangalore',
                locality: 'Indiranagar',
                rent: 90000,
                bedrooms: 3,
                bathrooms: 3,
                propertyType: 'HOUSE',
                furnishedStatus: 'SEMI_FURNISHED',
                isAvailable: false,
                isVerified: false,
                images: [],
              },
            ],
          }),
        });
      });

      await page.route('**/api/**/verification/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      });

      await page.goto('/owner');

      // 1. Verify dashboard heading
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Owner Dashboard', level: 1 })).toBeVisible();
      await expect(main.getByText('Manage your property listings and availability.')).toBeVisible();

      // 2. Verify stats cards
      await expect(main.getByRole('heading', { name: 'Total Properties' })).toBeVisible();
      await expect(main.getByText('2', { exact: true })).toBeVisible();

      const availableCard = main.locator('div.bg-card', { has: page.getByRole('heading', { name: 'Available', exact: true }) });
      await expect(availableCard.locator('p.text-3xl')).toHaveText('1');

      const unavailableCard = main.locator('div.bg-card', { has: page.getByRole('heading', { name: 'Rented / Unavailable', exact: true }) });
      await expect(unavailableCard.locator('p.text-3xl')).toHaveText('1');

      // 3. Verify property cards
      await expect(main.getByText('Bandra Luxury Apartment')).toBeVisible();
      await expect(main.getByText('Indiranagar Independent House')).toBeVisible();

      // 4. Verify Add Property CTA
      const addPropertyBtn = main.getByRole('link', { name: 'Add Property' });
      await expect(addPropertyBtn).toBeVisible();
      await expect(addPropertyBtn).toHaveAttribute('href', '/owner/properties/new');
    });

    test('2. Property creation form renders all required fields and validates required inputs', async ({ page }) => {
      await mockOwnerSession(page);

      await page.goto('/owner/properties/new');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'List a New Property', level: 1 })).toBeVisible();

      // Check required input fields
      const titleInput = main.getByLabel('Property Title');
      const descInput = main.getByPlaceholder('Describe the property features...');
      const cityInput = main.getByLabel('City');
      const localityInput = main.getByLabel('Locality / Sector');
      const rentInput = main.getByLabel('Monthly Rent (₹)');
      const bedroomsInput = main.getByLabel('Bedrooms');
      const bathroomsInput = main.getByLabel('Bathrooms');
      const createBtn = main.getByRole('button', { name: 'Create Property' });

      await expect(titleInput).toBeVisible();
      await expect(titleInput).toHaveAttribute('required', '');

      await expect(descInput).toBeVisible();
      await expect(descInput).toHaveAttribute('required', '');

      await expect(cityInput).toBeVisible();
      await expect(cityInput).toHaveAttribute('required', '');

      await expect(localityInput).toBeVisible();
      await expect(localityInput).toHaveAttribute('required', '');

      await expect(rentInput).toBeVisible();
      await expect(rentInput).toHaveAttribute('required', '');

      await expect(bedroomsInput).toBeVisible();
      await expect(bedroomsInput).toHaveAttribute('required', '');

      await expect(bathroomsInput).toBeVisible();
      await expect(bathroomsInput).toHaveAttribute('required', '');

      await expect(createBtn).toBeVisible();

      // Verify client-side HTML5 validation when empty
      const isTitleValid = await titleInput.evaluate((el: HTMLInputElement) => el.checkValidity());
      expect(isTitleValid).toBe(false);

      const isRentValid = await rentInput.evaluate((el: HTMLInputElement) => el.checkValidity());
      expect(isRentValid).toBe(false);
    });

    test('3. Submitting valid property creation form calls API and navigates to edit page', async ({ page }) => {
      await mockOwnerSession(page);

      const createdPropertyId = 'new-prop-xyz-789';

      // Mock property creation POST endpoint
      await page.route('**/api/**/properties', async (route) => {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON();
          expect(body.title).toBe('Sunny 2BHK Penthouse');
          expect(body.city).toBe('Pune');
          expect(body.rent).toBe(42000);

          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: createdPropertyId,
                title: body.title,
                city: body.city,
                locality: body.locality,
                rent: body.rent,
                owner: { id: MOCK_OWNER_USER.id },
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Mock the subsequent GET /properties/:id on the redirected edit page
      await page.route(`**/api/**/properties/${createdPropertyId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: createdPropertyId,
              title: 'Sunny 2BHK Penthouse',
              description: 'Bright and airy penthouse with terrace.',
              city: 'Pune',
              locality: 'Kalyani Nagar',
              address: 'Penthouse 14, Tower A',
              rent: 42000,
              securityDeposit: 84000,
              bedrooms: 2,
              bathrooms: 2,
              propertyType: 'APARTMENT',
              furnishedStatus: 'FURNISHED',
              isAvailable: true,
              images: [],
              owner: { id: MOCK_OWNER_USER.id },
            },
          }),
        });
      });

      await page.goto('/owner/properties/new');

      const main = page.getByRole('main');

      // Fill in valid details
      await main.getByLabel('Property Title').fill('Sunny 2BHK Penthouse');
      await main.getByPlaceholder('Describe the property features...').fill('Bright and airy penthouse with terrace.');
      await main.getByLabel('City').fill('Pune');
      await main.getByLabel('Locality / Sector').fill('Kalyani Nagar');
      await main.getByLabel('Full Address').fill('Penthouse 14, Tower A');
      await main.getByLabel('Monthly Rent (₹)').fill('42000');
      await main.getByLabel('Bedrooms').fill('2');
      await main.getByLabel('Bathrooms').fill('2');

      // Submit form
      await main.getByRole('button', { name: 'Create Property' }).click();

      // Verify navigation to the edit page for image uploads
      await expect(page).toHaveURL(new RegExp(`/owner/properties/${createdPropertyId}/edit`), { timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'Edit Property', level: 1 })).toBeVisible();
      await expect(page.getByText('Property Images')).toBeVisible();
    });

    test('4. Property creation handles and displays API error without crash', async ({ page }) => {
      await mockOwnerSession(page);

      // Mock property creation failure
      await page.route('**/api/**/properties', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'A listing with this title and locality already exists.',
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/owner/properties/new');

      const main = page.getByRole('main');

      await main.getByLabel('Property Title').fill('Duplicate Property Title');
      await main.getByPlaceholder('Describe the property features...').fill('Sample description for test.');
      await main.getByLabel('City').fill('Mumbai');
      await main.getByLabel('Locality / Sector').fill('Andheri West');
      await main.getByLabel('Monthly Rent (₹)').fill('50000');
      await main.getByLabel('Bedrooms').fill('2');
      await main.getByLabel('Bathrooms').fill('2');

      await main.getByRole('button', { name: 'Create Property' }).click();

      // Verify error alert message appears
      const errorBanner = main.locator('.bg-danger\\/10');
      await expect(errorBanner).toBeVisible();
      await expect(errorBanner).toHaveText('A listing with this title and locality already exists.');
    });
  });

  // ==========================================
  // TENANT SCENARIOS
  // ==========================================
  test.describe('Tenant Scenarios', () => {
    test('5. Favorites page renders deterministic saved-property fixtures and active favorite states', async ({ page }) => {
      await mockTenantSession(page);

      await page.route('**/api/**/favorites', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'fav-prop-1',
                title: 'Bandra Coastal View Flat',
                city: 'Mumbai',
                locality: 'Carter Road',
                rent: 85000,
                bedrooms: 2,
                bathrooms: 2,
                propertyType: 'APARTMENT',
                furnishedStatus: 'FURNISHED',
                isAvailable: true,
                images: [],
              },
              {
                id: 'fav-prop-2',
                title: 'Koramangala Studio Apartment',
                city: 'Bangalore',
                locality: 'Koramangala 4th Block',
                rent: 28000,
                bedrooms: 1,
                bathrooms: 1,
                propertyType: 'STUDIO',
                furnishedStatus: 'SEMI_FURNISHED',
                isAvailable: true,
                images: [],
              },
            ],
          }),
        });
      });

      await page.route('**/api/**/favorites/ids', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: ['fav-prop-1', 'fav-prop-2'],
          }),
        });
      });

      await page.goto('/favorites');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Saved Properties', level: 1 })).toBeVisible();

      // Verify both properties render
      await expect(main.getByText('Bandra Coastal View Flat')).toBeVisible();
      await expect(main.getByText('Koramangala Studio Apartment')).toBeVisible();

      // Verify favorite buttons are in favorited state
      const removeButtons = main.getByRole('button', { name: 'Remove from favorites' });
      await expect(removeButtons).toHaveCount(2);
      await expect(removeButtons.first()).toHaveAttribute('aria-pressed', 'true');
    });

    test('6. Favorites page renders empty state with explore link when no properties saved', async ({ page }) => {
      await mockTenantSession(page);

      await page.route('**/api/**/favorites', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      });

      await page.route('**/api/**/favorites/ids', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      });

      await page.goto('/favorites');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Saved Properties', level: 1 })).toBeVisible();
      await expect(main.getByText("You haven't saved any properties yet.")).toBeVisible();
      await expect(main.getByText('Click the heart icon on any property to save it here for easy access later.')).toBeVisible();

      const exploreBtn = main.getByRole('link', { name: 'Explore Properties' });
      await expect(exploreBtn).toBeVisible();
      await expect(exploreBtn).toHaveAttribute('href', '/properties');
    });

    test('7. Favorites page renders API error state when fetch fails', async ({ page }) => {
      await mockTenantSession(page);

      await page.route('**/api/**/favorites', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        });
      });

      await page.goto('/favorites');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Unable to load favorites', level: 3 })).toBeVisible();
      await expect(main.getByText('There was a problem communicating with the server.')).toBeVisible();
    });

    test('8. Add and remove favorite toggles UI state and handles optimistic revert on error', async ({ page }) => {
      await mockTenantSession(page);

      // Initial state: fav-prop-1 is favorited
      await page.route('**/api/**/favorites', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'fav-prop-1',
                title: 'Indiranagar 2BHK',
                city: 'Bangalore',
                locality: 'Indiranagar',
                rent: 32000,
                bedrooms: 2,
                bathrooms: 2,
                propertyType: 'APARTMENT',
                furnishedStatus: 'FURNISHED',
                isAvailable: true,
                images: [],
              },
            ],
          }),
        });
      });

      await page.route('**/api/**/favorites/ids', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: ['fav-prop-1'] }),
        });
      });

      await page.goto('/favorites');

      const main = page.getByRole('main');
      const favButton = main.getByRole('button', { name: 'Remove from favorites' });
      await expect(favButton).toBeVisible();
      await expect(favButton).toHaveAttribute('aria-pressed', 'true');

      // 1. Remove Favorite (DELETE succeeds)
      await page.route('**/api/**/properties/fav-prop-1/favorite', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.continue();
        }
      });

      await favButton.click();

      // Button should now transition to unfavorited state
      const addFavButton = main.getByRole('button', { name: 'Add to favorites' });
      await expect(addFavButton).toBeVisible();
      await expect(addFavButton).toHaveAttribute('aria-pressed', 'false');

      // 2. Add Favorite (POST fails -> triggers optimistic revert)
      await page.route('**/api/**/properties/fav-prop-1/favorite', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Network failure' }),
          });
        } else {
          await route.continue();
        }
      });

      await addFavButton.click();

      // On failure, optimistic update reverts back to unfavorited state
      await expect(main.getByRole('button', { name: 'Add to favorites' })).toBeVisible();
      await expect(main.getByRole('button', { name: 'Add to favorites' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // ==========================================
  // ROLE SEPARATION SCENARIOS
  // ==========================================
  test.describe('Role Separation Scenarios', () => {
    test('9. Tenant attempting to access owner dashboard and new property form gets Access Denied', async ({ page }) => {
      await mockTenantSession(page);

      // Attempt visiting /owner
      await page.goto('/owner');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Access Denied', level: 2 })).toBeVisible();
      await expect(main.getByText('You must be registered as a Property Owner to access this dashboard.')).toBeVisible();

      // Attempt visiting /owner/properties/new
      await page.goto('/owner/properties/new');
      await expect(main.getByRole('heading', { name: 'Access Denied', level: 2 })).toBeVisible();
      await expect(main.getByText('Only registered Property Owners can list properties.')).toBeVisible();
    });

    test('10. Owner attempting to access favorites page gets Access Denied, and is redirected from tenant dashboard', async ({ page }) => {
      await mockOwnerSession(page);

      // Attempt visiting /favorites
      await page.goto('/favorites');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Access Denied', level: 2 })).toBeVisible();
      await expect(main.getByText('Property Owners cannot access Tenant features.')).toBeVisible();

      // Mock owner dashboard endpoints for when redirected to /owner
      await page.route('**/api/**/properties/owner/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      });

      await page.route('**/api/**/verification/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      });

      // Attempt visiting /tenant -> actual application redirects owners to /owner
      await page.goto('/tenant');
      await expect(page).toHaveURL(/\/owner$/, { timeout: 10000 });
      await expect(main.getByRole('heading', { name: 'Owner Dashboard', level: 1 })).toBeVisible();
    });
  });
});
