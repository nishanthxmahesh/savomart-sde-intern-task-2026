import { api } from './client';

export async function fetchStores() {
  const { data } = await api.get('/api/stores');
  return data;
}
