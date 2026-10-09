const isServer = typeof window === 'undefined';

export const API_BASE_URL = isServer
  ? (process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api` : 'http://localhost:5000/api')
  : (process.env.NEXT_PUBLIC_API_URL || '/api/proxy');

interface FetchOptions extends RequestInit {
  params?: Record<string, any>;
}

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

  const config: RequestInit = {
    ...customConfig,
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

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'An error occurred during the request.');
  }

  return data;
}

export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body: any, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: any, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string, options?: FetchOptions) => apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
