import { createHmac, randomInt } from 'node:crypto';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(purpose, userId, otp, secret) {
  return createHmac('sha256', secret)
    .update(`${purpose}:${userId}:${otp}`)
    .digest('hex');
}
