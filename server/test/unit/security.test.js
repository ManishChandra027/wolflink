import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../../src/config/env.js';
import { normalizePhone } from '../../src/services/authService.js';
import { generateOtp, hashOtp } from '../../src/services/otpService.js';
import { registerSchema, verifyEmailSchema, resetOtpSchema } from '../../src/validation/authSchemas.js';
import { socketMessageSchema, socketReadSchema } from '../../src/validation/socketSchemas.js';
import { buildRegistrationPayload } from '../../../client/src/features/auth/registrationPayload.js';

const validEnv = {
  NODE_ENV: 'test', PORT: '4000', CLIENT_ORIGIN: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/wolflink',
  ACCESS_TOKEN_SECRET: 'a'.repeat(48), REFRESH_TOKEN_SECRET: 'b'.repeat(48), OTP_HASH_SECRET: 'c'.repeat(48),
};

test('configuration rejects a partial SMTP core configuration', () => {
  assert.throws(() => loadConfig({ ...validEnv, SMTP_HOST: 'mail.example.test' }), /SMTP_HOST, SMTP_PORT, and SMTP_FROM/);
});

test('email verification and password reset OTPs remain six digits and purpose-bound', () => {
  for (let count = 0; count < 100; count += 1) assert.match(generateOtp(), /^\d{6}$/);
  const subject = '0123456789abcdef01234567';
  assert.notEqual(hashOtp('email-verification', subject, '001234', validEnv.OTP_HASH_SECRET), hashOtp('password-reset', subject, '001234', validEnv.OTP_HASH_SECRET));
  assert.equal(verifyEmailSchema.validate({ otp: '001234' }).error, undefined);
  assert.equal(resetOtpSchema.validate({ email: 'person@example.test', otp: '001234' }).error, undefined);
});

test('registration requires a normalized username and keeps phone optional', () => {
  const signup = { name: 'Wolf Link', username: 'wolf_link', email: 'wolf@example.test', password: 'long-enough-password' };
  assert.equal(registerSchema.validate(signup).error, undefined);
  assert.ok(registerSchema.validate({ ...signup, email: 'invalid' }).error);
  assert.ok(registerSchema.validate({ ...signup, username: 'ab' }).error);
  assert.ok(registerSchema.validate({ ...signup, username: undefined }).error);
  assert.ok(registerSchema.validate({ ...signup, confirmPassword: 'long-enough-password' }).error);
  assert.equal(registerSchema.validate({ ...signup, username: 'Wolf_Link' }).value.username, 'wolf_link');
});

test('registration request normalizes identity and never sends confirmPassword', () => {
  const payload = buildRegistrationPayload({ name: ' Wolf Link ', username: 'Wolf_Link', email: ' WOLF@example.test ', password: 'password-123', confirmPassword: 'password-123', phone: '' });
  assert.deepEqual(payload, { name: 'Wolf Link', username: 'wolf_link', email: 'wolf@example.test', password: 'password-123', phone: '' });
  assert.equal(Object.hasOwn(payload, 'confirmPassword'), false);
});

test('SMTP accepts the legacy password variable and rejects partial or conflicting credentials', () => {
  const smtp = { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_FROM: 'WolfLink <noreply@example.test>', SMTP_USER: 'mailer' };
  assert.equal(loadConfig({ ...validEnv, ...smtp, SMTP_PASS: 'secret' }).smtpPassword, 'secret');
  assert.equal(loadConfig({ ...validEnv, ...smtp, SMTP_PASSWORD: 'secret' }).smtpPassword, 'secret');
  assert.throws(() => loadConfig({ ...validEnv, ...smtp }), /must be configured together/);
  assert.throws(() => loadConfig({ ...validEnv, ...smtp, SMTP_PASS: 'legacy', SMTP_PASSWORD: 'different' }), /must match/);
});

test('phone normalization preserves international prefixes and rejects invalid input', () => {
  assert.equal(normalizePhone(' +91 (98765) 43210 '), '+919876543210');
  assert.equal(normalizePhone(''), undefined);
  assert.throws(() => normalizePhone('98765 43210'), { code: 'INVALID_PHONE' });
});

test('socket messages require bounded text and a UUIDv4 client id', () => {
  const valid = { conversationId: '0123456789abcdef01234567', text: 'hello', clientMessageId: '123e4567-e89b-42d3-a456-426614174000' };
  assert.equal(socketMessageSchema.validate(valid).error, undefined);
  assert.ok(socketMessageSchema.validate({ ...valid, text: '  ' }).error);
  assert.ok(socketMessageSchema.validate({ ...valid, clientMessageId: 'not-a-uuid' }).error);
  assert.ok(socketMessageSchema.validate({ ...valid, text: 'a'.repeat(4001) }).error);
});

test('socket read markers accept only valid conversation and message ids', () => {
  assert.equal(socketReadSchema.validate({ conversationId: '0123456789abcdef01234567' }).error, undefined);
  assert.ok(socketReadSchema.validate({ conversationId: 'not-an-id' }).error);
});
