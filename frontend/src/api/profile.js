import { api } from './client';

export async function fetchProfile() {
  const { data } = await api.get('/api/profile/me');
  return data;
}

export async function fetchCoupons() {
  const { data } = await api.get('/api/profile/coupons');
  return data;
}

export async function fetchTransactions(limit = 10) {
  const { data } = await api.get('/api/profile/transactions', { params: { limit } });
  return data;
}
