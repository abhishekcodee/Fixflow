/**
 * FixFlow Centralized API Client
 * Wraps native fetch with auth token handling, JSON encoding, and unified error extraction.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://fixflowwww.onrender.com/api/v1' : '/api/v1');

export class ApiError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Low-level HTTP requester with token authorization and response parsing.
 */
export async function request(endpoint, options = {}) {
  const url = `${API_BASE.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
  const token = localStorage.getItem('fixflow_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch {
    throw new ApiError(
      'Unable to connect to the FixFlow server. Please verify your connection or server status.',
      0,
      'NETWORK_ERROR'
    );
  }

  // Parse response body if present
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorPayload = data?.error || {};
    let message = errorPayload.message;

    if (!message) {
      if (response.status === 404) {
        message = `API endpoint not found (404) at ${url}. Please verify that the backend API is deployed and VITE_API_BASE_URL is configured correctly.`;
      } else if (response.status === 405) {
        message = "API endpoint returned 405 Method Not Allowed at " + url + ". The request reached a static file host instead of the backend API. Please configure VITE_API_BASE_URL in your Vercel Project Settings (Environment Variables) to point to your live backend API and redeploy.";
      } else if (response.status >= 500) {
        message = `FixFlow backend service error (${response.status}). Please check server logs and database connectivity.`;
      } else {
        message = response.statusText || `Request failed with status ${response.status}`;
      }
    }

    const code = errorPayload.code || `HTTP_${response.status}`;
    const details = errorPayload.details || null;

    throw new ApiError(message, response.status, code, details);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  // If response is 200/201 but NOT JSON or data is null, request hit a static file server or CDN instead of the API
  if (!data) {
    throw new ApiError(
      `Received an invalid or non-JSON response from ${url} (Content-Type: "${contentType || 'none'}"). ` +
      `This typically occurs when VITE_API_BASE_URL is missing in your Render Static Site settings, ` +
      `causing API requests to hit the frontend static server instead of your FixFlow backend server. ` +
      `Please configure VITE_API_BASE_URL in your Render dashboard pointing to your backend Web Service (e.g. https://fixflow-api.onrender.com/api/v1).`,
      response.status,
      'INVALID_API_RESPONSE'
    );
  }

  if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return {
      ...data.data,
      meta: data.meta || null,
      pagination: data.meta
        ? {
            page: data.meta.page,
            limit: data.meta.limit,
            total: data.meta.totalCount,
            totalPages: data.meta.totalPages,
          }
        : null,
    };
  }

  return data?.data ?? data;
}

// Concrete API service modules
export const authApi = {
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  sendOtp: (payload) => request('/auth/send-otp', { method: 'POST', body: payload }),
  verifyOtp: (payload) => request('/auth/verify-otp', { method: 'POST', body: payload }),
  completeRegistration: (payload) => request('/auth/complete-registration', { method: 'POST', body: payload }),
  forgotPassword: (payload) => request('/auth/forgot-password', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload }),
  getProfile: () => request('/auth/me', { method: 'GET' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  deleteAccount: (payload) => request('/auth/me', { method: 'DELETE', body: payload }),
  getTechnicians: () => request('/auth/technicians', { method: 'GET' }),
  getGithubConfig: () => request('/auth/github/config', { method: 'GET' }),
  githubLogin: (code) => request('/auth/github', { method: 'POST', body: { code } }),
};

export const complaintsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    const queryString = query.toString();
    return request(`/complaints${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
  },
  getById: (id) => request(`/complaints/${id}`, { method: 'GET' }),
  create: (payload) => request('/complaints', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/complaints/${id}`, { method: 'PATCH', body: payload }),
  assign: (id, payload) => request(`/complaints/${id}/assign`, { method: 'POST', body: payload }),
  updateStatus: (id, payload) => request(`/complaints/${id}/status`, { method: 'POST', body: payload }),
  getHistory: (id) => request(`/complaints/${id}/history`, { method: 'GET' }),
  submitFeedback: (id, payload) => request(`/complaints/${id}/feedback`, { method: 'POST', body: payload }),
};
