// Admin API surface. Uses a dedicated axios instance so the customer
// JWT interceptor cannot accidentally send a customer token to admin
// endpoints (and vice versa). Admin token lives at a separate
// localStorage key.
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL;
if (!baseURL && import.meta.env.PROD) {
  throw new Error('VITE_API_URL is not set. Check .env.production.');
}

export const adminApi = axios.create({ baseURL, timeout: 15000 });

const ADMIN_TOKEN_KEY = 'savo_admin_token';
const ADMIN_USER_KEY = 'savo_admin_user';

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
export function setAdminToken(token) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}
export function getStoredAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function setStoredAdmin(admin) {
  if (admin) localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(admin));
  else localStorage.removeItem(ADMIN_USER_KEY);
}

adminApi.interceptors.request.use((config) => {
  const tok = getAdminToken();
  if (tok) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${tok}`;
  }
  return config;
});

let onAdminUnauthorized = null;
export function registerAdminUnauthorizedHandler(fn) {
  onAdminUnauthorized = fn;
}

adminApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      setAdminToken(null);
      setStoredAdmin(null);
      if (typeof onAdminUnauthorized === 'function') onAdminUnauthorized();
    }
    return Promise.reject(err);
  },
);

export function adminErrorMessage(err) {
  if (!err) return 'Something went wrong.';
  const d = err?.response?.data;
  if (typeof d?.detail === 'string') return d.detail;
  if (Array.isArray(d?.detail)) return d.detail[0]?.msg || 'Invalid request';
  if (err?.message === 'Network Error') return 'Cannot reach the server.';
  return err?.message || 'Something went wrong.';
}

// -- auth --
export async function adminLogin(email, password) {
  const { data } = await adminApi.post('/api/admin/login', { email, password });
  return data;
}
export async function adminMe() {
  const { data } = await adminApi.get('/api/admin/me');
  return data;
}

// -- dashboard --
export async function fetchAdminDashboard() {
  const { data } = await adminApi.get('/api/admin/dashboard');
  return data;
}

// -- offers --
export async function fetchAdminOffers() {
  const { data } = await adminApi.get('/api/admin/offers');
  return data;
}
export async function createAdminOffer(payload) {
  const { data } = await adminApi.post('/api/admin/offers', payload);
  return data;
}
export async function updateAdminOffer(id, payload) {
  const { data } = await adminApi.put(`/api/admin/offers/${id}`, payload);
  return data;
}
export async function deleteAdminOffer(id) {
  await adminApi.delete(`/api/admin/offers/${id}`);
}
export async function duplicateAdminOffer(id) {
  const { data } = await adminApi.post(`/api/admin/offers/${id}/duplicate`);
  return data;
}

// -- coupons --
export async function fetchAdminCoupons(params = {}) {
  const clean = {};
  if (params.used !== undefined) clean.used = params.used;
  if (params.expired !== undefined) clean.expired = params.expired;
  if (params.store_id) clean.store_id = params.store_id;
  const { data } = await adminApi.get('/api/admin/coupons', { params: clean });
  return data;
}
export async function issueAdminCoupon(payload) {
  const { data } = await adminApi.post('/api/admin/coupons/issue', payload);
  return data;
}
export async function bulkIssueAdminCoupons(payload) {
  const { data } = await adminApi.post('/api/admin/coupons/bulk-issue', payload);
  return data;
}

// -- points --
export async function adjustAdminPoints(payload) {
  const { data } = await adminApi.post('/api/admin/points/adjust', payload);
  return data;
}
export async function bulkAdjustAdminPoints(payload) {
  const { data } = await adminApi.post('/api/admin/points/bulk', payload);
  return data;
}
export async function fetchAdminLedger(params = {}) {
  const { data } = await adminApi.get('/api/admin/points/ledger', { params });
  return data;
}

// -- tickets --
export async function fetchAdminTickets(params = {}) {
  const { data } = await adminApi.get('/api/admin/tickets', { params });
  return data;
}
export async function fetchAdminTicket(publicId) {
  const { data } = await adminApi.get(`/api/admin/tickets/${publicId}`);
  return data;
}
export async function patchAdminTicket(publicId, payload) {
  const { data } = await adminApi.patch(`/api/admin/tickets/${publicId}`, payload);
  return data;
}

// -- users --
export async function fetchAdminUsers(q) {
  const { data } = await adminApi.get('/api/admin/users', { params: q ? { q } : {} });
  return data;
}
export async function createAdminCustomer(payload) {
  const { data } = await adminApi.post('/api/admin/users', payload);
  return data;
}
export async function fetchAdminUserDetail(userId) {
  const { data } = await adminApi.get(`/api/admin/users/${userId}`);
  return data;
}
export async function changeUserTier(userId, tier, reason) {
  const { data } = await adminApi.patch(`/api/admin/users/${userId}/tier`, { tier, reason });
  return data;
}
export async function deactivateUser(userId) {
  const { data } = await adminApi.patch(`/api/admin/users/${userId}/deactivate`);
  return data;
}
export async function reactivateUser(userId) {
  const { data } = await adminApi.patch(`/api/admin/users/${userId}/reactivate`);
  return data;
}
export async function importCustomersExcel(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await adminApi.post('/api/admin/users/import-excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}
export async function downloadImportTemplate() {
  const res = await adminApi.get('/api/admin/users/import-template', {
    responseType: 'blob',
  });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'savomart_customer_import_template.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// -- analytics --
export async function fetchAdminAnalytics() {
  const { data } = await adminApi.get('/api/admin/analytics');
  return data;
}
