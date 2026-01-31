const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    throw new ApiError(
      errorData.message || 'Request failed',
      response.status,
      errorData.error
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get: <T>(path: string, token?: string) => 
    request<T>('GET', path, undefined, token),
  
  post: <T>(path: string, body?: unknown, token?: string) => 
    request<T>('POST', path, body, token),
  
  patch: <T>(path: string, body?: unknown, token?: string) => 
    request<T>('PATCH', path, body, token),
  
  delete: <T>(path: string, token?: string) => 
    request<T>('DELETE', path, undefined, token),
};

export { ApiError };
