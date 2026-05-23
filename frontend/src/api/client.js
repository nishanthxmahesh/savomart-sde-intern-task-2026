import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      setToken(null);
      if (typeof onUnauthorized === 'function') onUnauthorized();
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
