import axios from 'axios';

// Hard requirement: VITE_API_URL must be set via .env.development /
// .env.production. No dev fallback — a missing env var should fail
// loudly during build/dev rather than silently pointing at a local server
// that doesn't exist in the deployed environment.
const baseURL = import.meta.env.VITE_API_URL;
if (!baseURL && import.meta.env.PROD) {
  throw new Error('VITE_API_URL is not set. Check .env.production.');
}

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

const TOKEN_KEY = 'savo_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized = null;
export function registerUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

let onUnexpectedError = null;
export function registerUnexpectedErrorHandler(fn) {
  onUnexpectedError = fn;
}

// "Loud" failures: surfaced via toast.
// Skips 4xx validation errors (caller-handled inline) and the auth endpoints
// during login (caller already shows the message in the form).
function isLoudFailure(err) {
  const status = err?.response?.status;
  const url = err?.config?.url || '';
  if (url.includes('/api/auth/')) return false;
  if (!status) return true; // network / CORS / timeout
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      setToken(null);
      if (typeof onUnauthorized === 'function') onUnauthorized();
    } else if (isLoudFailure(err) && typeof onUnexpectedError === 'function') {
      onUnexpectedError(apiErrorMessage(err));
    }
    return Promise.reject(err);
  },
);

export function apiErrorMessage(err) {
  if (!err) return 'Something went wrong.';
  const data = err?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) return data.detail[0]?.msg || 'Invalid request';
  if (err?.message === 'Network Error') return 'Cannot reach the server. Is it running?';
  return err?.message || 'Something went wrong.';
}
