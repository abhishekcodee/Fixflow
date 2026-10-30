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
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
    ...(options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
      ? { body: JSON.stringify(options.body) }
      : {}),
  };

  try {
    const response = await fetch(url, config);

    // Parse payload (graceful fallback on empty body or non-JSON payloads)
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        `Request to ${endpoint} failed with HTTP status ${response.status}`;
      const code = data?.error?.code || data?.code || 'HTTP_ERROR';
      const details = data?.error?.details || data?.errors || null;

      // Handle unauthenticated 401s across the client
      if (response.status === 401) {
        // If expired or unauthorized on private endpoint, wipe local token
        if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          localStorage.removeItem('fixflow_token');
          localStorage.removeItem('fixflow_user');
        }
      }

      throw new ApiError(message, response.status, code, details);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Network or abort error
    throw new ApiError(
      err.message || 'Network connection failed. Please ensure backend server is reachable.',
      0,
      'NETWORK_ERROR'
    );
  }
}

// -----------------------------------------------------------------------------
// Domain Specific API Clients
// -----------------------------------------------------------------------------

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
  verifyIdentity: (payload) => request('/auth/verify-identity', { method: 'POST', body: payload }),
  getTechnicians: () => request('/auth/technicians', { method: 'GET' }),
  getGithubConfig: () => request('/auth/github/config', { method: 'GET' }),
  githubLogin: (code) => request('/auth/github', { method: 'POST', body: { code } }),
};

export const identityApi = {
  initiate: (payload) => request('/identity/aadhaar/initiate', { method: 'POST', body: payload }),
  verifyOtp: (payload) => request('/identity/aadhaar/verify-otp', { method: 'POST', body: payload }),
  uploadDocuments: async (formData) => {
    const token = localStorage.getItem('fixflow_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${API_BASE.replace(/\/+$/, '')}/identity/aadhaar/upload-documents`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data?.error?.message || data?.message || 'Failed to upload documents.', res.status);
    }
    return data;
  },
  getStatus: () => request('/identity/aadhaar/status', { method: 'GET' }),
  getDocumentBlob: async (side) => {
    const token = localStorage.getItem('fixflow_token');
    const url = `${API_BASE.replace(/\/+$/, '')}/identity/aadhaar/documents/${side}`;
    const res = await fetch(url, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) }
    });
    if (!res.ok) throw new Error('Failed to retrieve document image');
    return res.blob();
  }
};

export const techniciansApi = {
  getMe: () => request('/technicians/me', { method: 'GET' }),
  updateMe: (payload) => request('/technicians/me', { method: 'PATCH', body: payload }),
  toggleAvailability: (isAvailable) => request('/technicians/availability', { method: 'PATCH', body: { isAvailable } }),
  getMatching: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    const queryString = query.toString();
    return request(`/technicians/matching${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
  },
};

export const adminApi = {
  getTechnicians: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    const queryString = query.toString();
    return request(`/admin/technicians${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
  },
  updateTechnicianApproval: (id, payload) => request(`/admin/technicians/${id}/approval`, { method: 'PATCH', body: payload }),
  getCategoryMappings: () => request('/admin/category-mappings', { method: 'GET' }),
  updateCategoryMapping: (category, payload) => request(`/admin/category-mappings/${category}`, { method: 'PUT', body: payload }),
  getIdentityVerifications: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    const queryString = query.toString();
    return request(`/admin/identity-verifications${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
  },
  getAdminDocumentBlob: async (verificationId, side) => {
    const token = localStorage.getItem('fixflow_token');
    const url = `${API_BASE.replace(/\/+$/, '')}/admin/identity-verifications/${verificationId}/documents/${side}`;
    const res = await fetch(url, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) }
    });
    if (!res.ok) throw new Error('Failed to retrieve document image');
    return res.blob();
  },
  reviewIdentityVerification: (id, payload) => request(`/admin/identity-verifications/${id}/review`, { method: 'PATCH', body: payload }),
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
  getMatchingTechnicians: (id) => request(`/complaints/${id}/matching-technicians`, { method: 'GET' }),
  create: (payload) => request('/complaints', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/complaints/${id}`, { method: 'PATCH', body: payload }),
  assign: (id, payload) => request(`/complaints/${id}/assign`, { method: 'POST', body: payload }),
  updateStatus: (id, payload) => request(`/complaints/${id}/status`, { method: 'POST', body: payload }),
  getHistory: (id) => request(`/complaints/${id}/history`, { method: 'GET' }),
  submitFeedback: (id, payload) => request(`/complaints/${id}/feedback`, { method: 'POST', body: payload }),
};
