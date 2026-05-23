import { api } from './client';

export async function fetchOffers(params = {}) {
  const clean = {};
  if (params.scope) clean.scope = params.scope;
  if (params.category) clean.category = params.category;
  if (params.expiring_soon) clean.expiring_soon = true;
  if (params.eligible_only) clean.eligible_only = true;
  if (params.q) clean.q = params.q;
  const { data } = await api.get('/api/offers', { params: clean });
  return data;
}
