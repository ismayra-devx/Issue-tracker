const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function formatErrorMessage(data, fallback) {
  if (!data) return fallback;

  // Single string detail, e.g. {"detail": "Invalid email or password"}
  if (typeof data.detail === 'string') {
    return data.detail;
  }

  // Pydantic validation error array, e.g. {"detail": [{"loc": ["body", "title"], "msg": "..."}]}
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((err) => {
        const fieldName = Array.isArray(err.loc)
          ? err.loc.filter((part) => part !== 'body').join('.')
          : '';
        return fieldName ? `${fieldName}: ${err.msg}` : err.msg;
      })
      .join(', ');
  }

  if (data.message && typeof data.message === 'string') {
    return data.message;
  }

  return fallback;
}

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (networkErr) {
    throw new ApiError(0, 'Unable to connect to the server. Please check your network.', networkErr);
  }

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errorMsg = formatErrorMessage(data, res.statusText || 'Request failed');

    if (res.status === 401) {
      localStorage.removeItem('token');
      const isLoginEndpoint = endpoint.includes('/auth/login');
      const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
      if (!isLoginEndpoint && !isLoginPage && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    throw new ApiError(res.status, errorMsg, data);
  }

  return data;
}

export const client = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body }),
  patch: (endpoint, body, options) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
};

export default client;
