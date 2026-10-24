/**
 * Deterministic Test Fixtures and Scoped Cleanup Helper for Full-Stack E2E Tests.
 * Strictly communicates with the local guarded test backend (port 5001).
 * Tracks all created entity IDs for deterministic scoped cleanup.
 */

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'TENANT' | 'OWNER';
  cookie: string;
}

export interface TestProperty {
  id: string;
  ownerId: string;
  title: string;
  rent: number;
  city: string;
  locality: string;
}

export interface TestRentalRequest {
  id: string;
  propertyId: string;
  tenantId: string;
  status: string;
  message?: string;
  conversation?: {
    id: string;
  };
}

export interface TestConversation {
  id: string;
  propertyId: string;
  tenantId: string;
  ownerId: string;
  rentalRequestId?: string | null;
}

export class TestFixtureManager {
  private backendUrl: string;
  public trackedUserIds = new Set<string>();
  public trackedPropertyIds = new Set<string>();
  public trackedRentalRequestIds = new Set<string>();
  public trackedConversationIds = new Set<string>();

  constructor(backendUrl = 'http://127.0.0.1:5001') {
    this.backendUrl = backendUrl;
  }

  /**
   * Registers a test user via the backend authentication endpoint.
   */
  async registerUser(role: 'TENANT' | 'OWNER', prefix?: string): Promise<TestUser> {
    const ts = Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const email = `${role.toLowerCase()}_e2e_${ts}@rentgoer.test`;
    const password = 'Password123!';
    const name = `${prefix || role} E2E ${ts}`;

    const res = await fetch(`${this.backendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to register test user (${res.status}): ${err.message || res.statusText}`);
    }

    const data = await res.json();
    const setCookie = res.headers.get('set-cookie') || '';
    const tokenMatch = setCookie.match(/rentgoer_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : '';

    const rawUser = data.user || data.data;
    const user: TestUser = {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      password,
      role,
      cookie: token,
    };

    this.trackedUserIds.add(user.id);
    return user;
  }

  /**
   * Creates a test property owned by the test owner via the backend property endpoint.
   */
  async createProperty(owner: TestUser, titlePrefix?: string): Promise<TestProperty> {
    const ts = Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const title = `${titlePrefix || 'E2E Apartment'} ${ts}`;

    const res = await fetch(`${this.backendUrl}/api/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rentgoer_token=${owner.cookie}`,
      },
      body: JSON.stringify({
        title,
        description: 'Prime verified property for automated full-stack E2E lifecycle testing.',
        rent: 35000,
        securityDeposit: 70000,
        city: 'Mumbai',
        locality: 'Bandra West',
        address: '101 Sea Breeze Apt, Bandra West',
        bedrooms: 2,
        bathrooms: 2,
        propertyType: 'APARTMENT',
        furnishedStatus: 'FURNISHED',
        isAvailable: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to create test property (${res.status}): ${err.message || res.statusText}`);
    }

    const data = await res.json();
    const property: TestProperty = {
      id: data.data.id,
      ownerId: owner.id,
      title: data.data.title,
      rent: data.data.rent,
      city: data.data.city,
      locality: data.data.locality,
    };

    this.trackedPropertyIds.add(property.id);
    return property;
  }

  /**
   * Submits a rental request for a property as the authenticated tenant.
   */
  async submitRentalRequest(
    tenant: TestUser,
    propertyId: string,
    message?: string
  ): Promise<TestRentalRequest> {
    const res = await fetch(`${this.backendUrl}/api/properties/${propertyId}/rental-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rentgoer_token=${tenant.cookie}`,
      },
      body: JSON.stringify({
        message: message || 'Hello, I am interested in renting this property for 12 months.',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to submit rental request (${res.status}): ${err.message || res.statusText}`);
    }

    const data = await res.json();
    const request: TestRentalRequest = data.data;
    this.trackedRentalRequestIds.add(request.id);
    return request;
  }

  /**
   * Accepts a rental request as the authenticated owner, linking or establishing the conversation.
   */
  async acceptRentalRequest(
    owner: TestUser,
    rentalRequestId: string
  ): Promise<{ rentalRequest: TestRentalRequest; conversation?: TestConversation }> {
    const res = await fetch(`${this.backendUrl}/api/rental-requests/${rentalRequestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rentgoer_token=${owner.cookie}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to accept rental request (${res.status}): ${err.message || res.statusText}`);
    }

    const data = await res.json();
    const acceptedRequest = data.data;
    if (acceptedRequest.conversation?.id) {
      this.trackedConversationIds.add(acceptedRequest.conversation.id);
    }
    return {
      rentalRequest: acceptedRequest,
      conversation: acceptedRequest.conversation,
    };
  }

  /**
   * Creates a direct conversation (e.g. pre-rental inquiry) as the authenticated tenant.
   */
  async createConversation(tenant: TestUser, propertyId: string): Promise<TestConversation> {
    const res = await fetch(`${this.backendUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rentgoer_token=${tenant.cookie}`,
      },
      body: JSON.stringify({ propertyId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to create conversation (${res.status}): ${err.message || res.statusText}`);
    }

    const data = await res.json();
    const conversation: TestConversation = data.data;
    this.trackedConversationIds.add(conversation.id);
    return conversation;
  }

  /**
   * Safe, targeted cleanup: sends tracked IDs to the guarded test-server cleanup endpoint.
   * Only deletes records created during this test run.
   */
  async cleanup(): Promise<void> {
    if (
      this.trackedUserIds.size === 0 &&
      this.trackedPropertyIds.size === 0 &&
      this.trackedRentalRequestIds.size === 0 &&
      this.trackedConversationIds.size === 0
    ) {
      return;
    }

    try {
      const res = await fetch(`${this.backendUrl}/api/test/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(this.trackedUserIds),
          propertyIds: Array.from(this.trackedPropertyIds),
          rentalRequestIds: Array.from(this.trackedRentalRequestIds),
          conversationIds: Array.from(this.trackedConversationIds),
        }),
      });

      if (!res.ok) {
        console.error('[CLEANUP] Failed to perform scoped cleanup:', await res.text());
      }
    } catch (err) {
      console.error('[CLEANUP] Error during scoped cleanup:', err);
    } finally {
      this.trackedUserIds.clear();
      this.trackedPropertyIds.clear();
      this.trackedRentalRequestIds.clear();
      this.trackedConversationIds.clear();
    }
  }
}
