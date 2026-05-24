import { api } from './client';

export async function verifyFirebaseToken(firebaseToken, mobileNumber) {
  const { data } = await api.post('/api/auth/verify-firebase-token', {
    firebase_token: firebaseToken,
    mobile_number: mobileNumber,
  });
  return data;
}
