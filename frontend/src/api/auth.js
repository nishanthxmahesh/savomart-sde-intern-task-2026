import { api } from './client';

export async function sendOtp(mobileNumber) {
  const { data } = await api.post('/api/auth/send-otp', { mobile_number: mobileNumber });
  return data;
}

export async function verifyOtp(mobileNumber, otp) {
  const { data } = await api.post('/api/auth/verify-otp', { mobile_number: mobileNumber, otp });
  return data;
}
