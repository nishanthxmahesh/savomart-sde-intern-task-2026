import { api } from './client';

export async function fetchSupportInfo() {
  const { data } = await api.get('/api/support/info');
  return data;
}

export async function createTicket(payload) {
  const { data } = await api.post('/api/support/ticket', payload);
  return data;
}

export async function fetchMyTickets() {
  const { data } = await api.get('/api/support/my-tickets');
  return data;
}
