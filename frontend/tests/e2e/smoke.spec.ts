import { test, expect } from './fixtures';

test.describe('Frontend-Only Smoke Suite', () => {
  test('1. Landing page renders branding, navigation, hero, and value propositions', async ({ page }) => {
    await page.goto('/');

    // 1. Verify primary branding & title
    await expect(page).toHaveTitle(/RentGoer/i);
    const brandLogo = page.getByRole('link', { name: /RentGoer Home/i });
    await expect(brandLogo).toBeVisible();

    // 2. Verify desktop navigation controls for unauthenticated user
    const propertiesNavLink = page.getByRole('link', { name: 'Properties', exact: true }).first();
    await expect(propertiesNavLink).toBeVisible();

    const navLoginLink = page.getByRole('navigation').getByRole('link', { name: 'Log in' });
    await expect(navLoginLink).toBeVisible();

    const navSignUpLink = page.getByRole('navigation').getByRole('link', { name: 'Sign up' });
    await expect(navSignUpLink).toBeVisible();

    // 3. Verify Hero headline & call-to-actions
    const heroHeading = page.getByRole('heading', { level: 1 });
    await expect(heroHeading).toContainText('Find your place.');
    await expect(heroHeading).toContainText('Skip the broker.');

    const findPropertyHeroBtn = page.getByRole('link', { name: 'Find a Property' });
    await expect(findPropertyHeroBtn).toBeVisible();
    await expect(findPropertyHeroBtn).toHaveAttribute('href', '/properties');

    const listPropertyHeroBtn = page.getByRole('link', { name: 'List Your Property' });
    await expect(listPropertyHeroBtn).toBeVisible();
    await expect(listPropertyHeroBtn).toHaveAttribute('href', '/register?role=OWNER');

    // 4. Verify value proposition section
    await expect(page.getByRole('heading', { name: 'Direct Discovery', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verified Owners', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Zero Brokerage', level: 3 })).toBeVisible();
  });

  test('2. Login form renders and handles client-side and API validation', async ({ page }) => {
    await page.goto('/login');

    const main = page.getByRole('main');

    // 1. Verify heading and descriptive text
    await expect(main.getByRole('heading', { name: 'Welcome back', level: 2 })).toBeVisible();
    await expect(main.getByText('Log in to manage your properties or rental requests.')).toBeVisible();

    // 2. Verify input fields and attributes
    const emailInput = main.getByLabel('Email address');
    const passwordInput = main.getByLabel('Password');
    const submitBtn = main.getByRole('button', { name: 'Log in', exact: true });

    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required', '');

    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');

    // 3. Client-side HTML5 form validation checks
    const isEmailValidInitial = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isEmailValidInitial).toBe(false);

    await emailInput.fill('not-an-email');
    const isEmailValidMalformed = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isEmailValidMalformed).toBe(false);

    // 4. Test API error response handling with deterministic mock
    await page.route('**/api/**/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password.' }),
      });
    });

    await emailInput.fill('tenant@example.com');
    await passwordInput.fill('wrongpassword123');
    await submitBtn.click();

    const errorAlert = main.getByRole('alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toHaveText('Invalid email or password.');
  });

  test('3. Registration form renders and handles client-side password length and API duplicate email validation', async ({ page }) => {
    await page.goto('/register');

    const main = page.getByRole('main');

    // 1. Verify form heading
    await expect(main.getByRole('heading', { name: 'Create an account', level: 2 })).toBeVisible();

    const nameInput = main.getByLabel('Full Name');
    const emailInput = main.getByLabel('Email address');
    const passwordInput = main.getByLabel('Password');
    const roleSelect = main.getByLabel('I am a...');
    const submitBtn = main.getByRole('button', { name: 'Sign up', exact: true });

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(roleSelect).toBeVisible();

    // 2. Client-side validation: Password length must be at least 8 characters
    await nameInput.fill('John Doe');
    await emailInput.fill('johndoe@example.com');
    await passwordInput.fill('short'); // 5 chars (< 8)
    await submitBtn.click();

    const clientErrorAlert = main.getByRole('alert');
    await expect(clientErrorAlert).toBeVisible();
    await expect(clientErrorAlert).toHaveText('Password must be at least 8 characters long.');

    // 3. API error handling: duplicate email conflict
    await page.route('**/api/**/auth/register', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email already in use' }),
      });
    });

    await passwordInput.fill('securePassword123!');
    await submitBtn.click();

    await expect(clientErrorAlert).toBeVisible();
    await expect(clientErrorAlert).toHaveText('An account with this email already exists.');
  });

  test('4. Property search and filter controls render and update query parameters', async ({ page }) => {
    await page.goto('/properties');

    const main = page.getByRole('main');

    // 1. Verify page heading
    await expect(main.getByRole('heading', { name: 'Browse Properties', level: 1 })).toBeVisible();

    // 2. Search inputs scoped to main content
    const cityInput = main.getByPlaceholder('City...');
    const localityInput = main.getByPlaceholder('Locality...');
    const searchBtn = main.getByRole('button', { name: 'Search', exact: true });

    await expect(cityInput).toBeVisible();
    await expect(localityInput).toBeVisible();
    await expect(searchBtn).toBeVisible();

    // 3. Apply city and locality filter and assert URL update
    await cityInput.fill('Mumbai');
    await localityInput.fill('Bandra');
    await searchBtn.click();

    await expect(page).toHaveURL(/city=Mumbai/);
    await expect(page).toHaveURL(/locality=Bandra/);

    // 4. Change sorting dropdown and assert URL update
    const sortDropdown = main.locator('select').first();
    await sortDropdown.selectOption('rent_asc');

    await expect(page).toHaveURL(/sortBy=rent_asc/);

    // 5. Expand advanced filters
    const moreFiltersBtn = main.getByRole('button', { name: /More Filters/i });
    await moreFiltersBtn.click();

    await expect(main.getByRole('heading', { name: 'Advanced Filters', level: 3 })).toBeVisible();
    await expect(main.getByPlaceholder('Min Rent')).toBeVisible();
    await expect(main.getByPlaceholder('Max Rent')).toBeVisible();
  });

  test('5. Unauthenticated access to protected routes redirects to login', async ({ page }) => {
    // 1. Accessing /owner should redirect unauthenticated users to /login
    await page.goto('/owner');
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });

    // 2. Accessing /tenant should redirect unauthenticated users to /login
    await page.goto('/tenant');
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });

    // 3. Accessing /rental-requests should redirect unauthenticated users to /login
    await page.goto('/rental-requests');
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });

    // 4. Accessing /profile should redirect unauthenticated users to /login?redirect=/profile
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile|\/login\?redirect=\/profile/, { timeout: 10000 });
  });
});
