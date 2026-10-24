import { getSafeBackendUrl } from './backend-guard';

const isServer = typeof window === 'undefined';

export const API_BASE_URL = isServer
  ? `${getSafeBackendUrl()}/api`
  : (process.env.NEXT_PUBLIC_API_URL || '/api/proxy');

interface FetchOptions extends RequestInit {
  params?: Record<string, any>;
}

// In-flight request deduplication map for client-side GET requests
const inFlightGetRequests = new Map<string, Promise<any>>();

async function apiRequest<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const method = (customConfig.method || 'GET').toUpperCase();

  // Deduplicate concurrent client-side GET requests to identical URLs
  if (!isServer && method === 'GET') {
    const existingPromise = inFlightGetRequests.get(url);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }
  }

  const config: RequestInit = {
    ...customConfig,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    // Required to send and receive cookies from backend for auth
    credentials: 'include',
  };

  if (isServer) {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const token = cookieStore.get('rentgoer_token')?.value;
      if (token) {
        config.headers = {
          ...config.headers,
          Cookie: `rentgoer_token=${token}`
        };
      }
    } catch (e) {
      // Ignore errors when cookies() is used outside of request context
    }
  }

  const execute = async (): Promise<T> => {
    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred during the request.');
      }

      return data as T;
    } finally {
      if (!isServer && method === 'GET') {
        inFlightGetRequests.delete(url);
      }
    }
  };

  if (!isServer && method === 'GET') {
    const promise = execute();
    inFlightGetRequests.set(url, promise);
    return promise;
  }

  return execute();
}

export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body: any, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: any, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: any, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
