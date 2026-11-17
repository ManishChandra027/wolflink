import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { loadConfig } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { generateOtp, hashOtp, OTP_MAX_ATTEMPTS } from '../src/services/otpService.js';
import { verifyEmail } from '../src/services/authService.js';
import { sendEmail } from '../src/services/emailService.js';

const mongoUrl = new URL(process.env.MONGODB_URI);
mongoUrl.pathname = `${mongoUrl.pathname.replace(/\/$/, '') || '/wolflink'}_otp_test_${randomUUID().replaceAll('-', '')}`;
const config = loadConfig({ ...process.env, NODE_ENV: 'test', MONGODB_URI: mongoUrl.toString() });
let expiredUserId;
let exhaustedUserId;

before(async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  const suffix = randomUUID();
  const expired = await User.create({ name: 'Expired User', username: `expired_${suffix.slice(0, 8)}`, email: `expired-${suffix}@example.invalid`, passwordHash: 'test-hash' });
  expiredUserId = expired._id.toString();
  expired.emailVerificationOtpHash = hashOtp('email-verification', expired._id.toString(), '001234', config.otpHashSecret);
  expired.emailVerificationOtpExpiresAt = new Date(Date.now() - 1000);
  expired.emailVerificationOtpAttempts = 0;
  await expired.save();

  const exhausted = await User.create({ name: 'Attempt User', username: `attempt_${suffix.slice(0, 8)}`, email: `attempts-${suffix}@example.invalid`, passwordHash: 'test-hash' });
  exhaustedUserId = exhausted._id.toString();
  exhausted.emailVerificationOtpHash = hashOtp('email-verification', exhausted._id.toString(), '001234', config.otpHashSecret);
  exhausted.emailVerificationOtpExpiresAt = new Date(Date.now() + 60_000);
  exhausted.emailVerificationOtpAttempts = OTP_MAX_ATTEMPTS - 1;
  await exhausted.save();
});

after(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('OTP generation and hashing preserve format and purpose separation', () => {
  for (let i = 0; i < 100; i += 1) assert.match(generateOtp(), /^\d{6}$/);
  const subject = '0123456789abcdef01234567';
  const emailHash = hashOtp('email-verification', subject, '001234', config.otpHashSecret);
  assert.notEqual(emailHash, hashOtp('password-reset', subject, '001234', config.otpHashSecret));
  assert.notEqual(emailHash, hashOtp('email-verification', subject, '001235', config.otpHashSecret));
});

test('mail delivery fails explicitly when SMTP is not configured', async () => {
  const noMailConfig = { ...config, smtpHost: null, smtpPort: undefined, smtpFrom: null };
  await assert.rejects(
    sendEmail(noMailConfig, { to: 'person@example.invalid', subject: 'Test', text: 'Test' }),
    { code: 'EMAIL_NOT_CONFIGURED', status: 503 },
  );
});

test('expired verification codes are rejected and cleared', async () => {
  await assert.rejects(verifyEmail(expiredUserId, { otp: '001234' }, config), { code: 'INVALID_OR_EXPIRED_CODE' });
  const user = await User.findById(expiredUserId).select('+emailVerificationOtpHash');
  assert.equal(user.emailVerificationOtpHash, null);
});

test('the final invalid attempt consumes the verification code', async () => {
  await assert.rejects(verifyEmail(exhaustedUserId, { otp: '999999' }, config), { code: 'INVALID_OR_EXPIRED_CODE' });
  const user = await User.findById(exhaustedUserId).select('+emailVerificationOtpHash +emailVerificationOtpAttempts');
  assert.equal(user.emailVerificationOtpAttempts, OTP_MAX_ATTEMPTS);
  assert.equal(user.emailVerificationOtpHash, null);
});
