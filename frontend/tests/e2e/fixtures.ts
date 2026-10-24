import { test as baseTest, expect, Page } from '@playwright/test';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'TENANT' | 'OWNER' | 'ADMIN';
  phone?: string | null;
  isVerified?: boolean;
  createdAt?: string;
}

export const MOCK_OWNER_USER: User = {
  id: 'mock-owner-id-123',
  name: 'Dev Owner',
  email: 'owner@rentgoer.test',
  role: 'OWNER',
  phone: '+91 9876543210',
  isVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const MOCK_TENANT_USER: User = {
  id: 'mock-tenant-id-456',
  name: 'Dev Tenant',
  email: 'tenant@rentgoer.test',
  role: 'TENANT',
  phone: '+91 9876543211',
  isVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Strict Local Origin Allowlist:
 * Strictly limited to the approved frontend origin (port 3100) and dedicated guarded test backend (port 5001).
 * Port 5000, port 3000, production backend (render.com), deployed frontend (vercel.app),
 * and remote databases are strictly rejected.
 */
const APPROVED_LOCAL_ORIGINS = new Set([
  'http://localhost:3100',
  'http://127.0.0.1:3100',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
]);

/**
 * Known third-party request patterns (e.g. Supabase storage public CDN, Google fonts)
 * that are safely intercepted and mocked locally to prevent live network egress.
 */
const MOCKED_THIRD_PARTY_PATTERNS = [
  /\.supabase\.co/i,
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
];

export function isMockedThirdParty(urlString: string): boolean {
  return MOCKED_THIRD_PARTY_PATTERNS.some((pattern) => pattern.test(urlString));
}

export function isApprovedLocalOrigin(urlString: string): boolean {
  if (urlString.startsWith('data:') || urlString.startsWith('blob:')) {
    return true;
  }
  try {
    const parsed = new URL(urlString);
    return APPROVED_LOCAL_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

/**
 * Validates whether a requested URL is permitted (approved local origin or intercepted third-party mock).
 * All other external URLs fail closed.
 */
export function isAllowedUrl(urlString: string): boolean {
  return isApprovedLocalOrigin(urlString) || isMockedThirdParty(urlString);
}

/**
 * Helper to mock an authenticated session for a given user (used in frontend-only mock tests).
 */
export async function mockSession(page: Page, user: User) {
  await page.context().addCookies([
    {
      name: 'rentgoer_token',
      value: `mock_jwt_token_${user.id}`,
      domain: 'localhost',
      path: '/',
    },
  ]);

  await page.route('**/api/**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user,
      }),
    });
  });
}

export async function mockOwnerSession(page: Page, overrides?: Partial<User>) {
  await mockSession(page, { ...MOCK_OWNER_USER, ...overrides });
}

export async function mockTenantSession(page: Page, overrides?: Partial<User>) {
  await mockSession(page, { ...MOCK_TENANT_USER, ...overrides });
}

type TestFixtures = {
  fullStack: boolean;
};

export const test = baseTest.extend<TestFixtures>({
  fullStack: [false, { option: true }],

  page: async ({ page, fullStack }, use) => {
    // 1. Strict Outbound Network Allowlist Guard:
    // Throws immediately if any request attempts to reach an unauthorized origin.
    page.on('request', (request) => {
      const url = request.url();
      if (!isAllowedUrl(url)) {
        throw new Error(
          `CRITICAL ISOLATION BREACH: Unexpected outbound request outside approved local allowlist: ${url}`
        );
      }
    });

    // 2. Proactive Network Abort: Abort any route outside the local allowlist or third-party mock list
    await page.route(
      (url) => !isAllowedUrl(url.href),
      (route) => {
        route.abort('blockedbyclient');
      }
    );

    // 3. Proactive Third-Party Mock Interception:
    // Intercepts any external assets (Supabase Storage image CDN, Google Fonts) with dummy responses.
    await page.route('**/*.supabase.co/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from(''),
      });
    });

    // 3b. Proactive Next.js Image Optimizer Interception (SEC-03):
    // Intercepts /_next/image requests in the browser before they reach the local Next.js server.
    // This prevents the Next.js server from executing server-to-server outbound fetches
    // to remote image hosts (e.g. Supabase Storage CDN) during E2E runs.
    await page.route('**/_next/image*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      });
    });

    await page.route('**/*fonts.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '',
      });
    });

    await page.route('**/*fonts.gstatic.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'font/woff2',
        body: Buffer.from(''),
      });
    });

    // 4. Default Mocks for Frontend-Only Mock Tests (skipped when fullStack: true)
    if (!fullStack) {
      await page.route('**/api/**/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Unauthenticated' }),
        });
      });

      await page.route('**/api/**/notifications/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], count: 0 }),
        });
      });

      await page.route('**/api/**/conversations/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, count: 0 }),
        });
      });

      await page.route('**/api/**/favorites/ids', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      });
    }

    await use(page);
  },
});

export { expect };
