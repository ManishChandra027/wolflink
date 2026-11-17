import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { hashOtp } from '../src/services/otpService.js';

const email = `auth-test-${randomUUID()}@example.invalid`;
const failedEmail = `mail-failure-${randomUUID()}@example.invalid`;
const mongoUrl = new URL(process.env.MONGODB_URI);
mongoUrl.pathname = `${mongoUrl.pathname.replace(/\/$/, '') || '/wolflink'}_auth_test_${randomUUID().replaceAll('-', '')}`;
const config = loadConfig({ ...process.env, NODE_ENV: 'test', MONGODB_URI: mongoUrl.toString() });
let server;
let baseUrl;
let verificationOtp;
let signupCookies;
const failedEmails = new Set([failedEmail]);

function cookieValue(setCookie, name) {
  const cookie = setCookie.find((value) => value.startsWith(`${name}=`));
  assert.ok(cookie, `Expected ${name} cookie`);
  return cookie.split(';', 1)[0];
}

function cookiesFor(setCookie, names = ['wl_access', 'wl_refresh']) {
  return names.map((name) => cookieValue(setCookie, name)).join('; ');
}

async function request(path, { method = 'GET', body, cookie, origin } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

before(async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  server = createApp(config, {
    sendEmail: async (_mailConfig, { to, otp }) => {
      if (failedEmails.has(to)) throw Object.assign(new Error('SMTP unavailable'), { status: 503, code: 'EMAIL_DELIVERY_FAILED' });
      if (to === email) verificationOtp = otp;
    },
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await User.deleteOne({ email });
    await mongoose.connection.dropDatabase();
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test('registration, login, session restoration, refresh rotation, and logout', async () => {
  const unauthorized = await request('/api/auth/me');
  assert.equal(unauthorized.status, 401);

  const invalid = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'A', username: 'wolf_1', email: 'not-an-email', password: 'short' },
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'VALIDATION_ERROR');

  const crossOrigin = await request('/api/auth/register', {
    method: 'POST',
    origin: 'https://example.invalid',
    body: { name: 'Wolf Link', username: 'wolf_link', email, password: 'test-password-1' },
  });
  assert.equal(crossOrigin.status, 403);

  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Wolf Link', username: 'Wolf_Link_01', email: email.toUpperCase(), password: 'test-password-1' },
  });
  assert.equal(registered.status, 201);
  const registeredBody = await registered.json();
  assert.equal(registeredBody.data.email, email);
  assert.equal(registeredBody.data.user.username, 'wolf_link_01');
  assert.match(registeredBody.data.message, /verification code/i);
  assert.equal(JSON.stringify(registeredBody).includes(verificationOtp), false);
  signupCookies = cookiesFor(registered.headers.getSetCookie());

  let storedUser = await User.findOne({ email }).select('+passwordHash +refreshTokenHash +emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts');
  assert.ok(storedUser.passwordHash.startsWith('$2'));
  assert.notEqual(storedUser.passwordHash, 'test-password-1');
  assert.equal(storedUser.emailVerified, false);
  assert.equal(storedUser.username, 'wolf_link_01');
  assert.equal(Object.hasOwn(storedUser.toObject(), 'confirmPassword'), false);
  assert.ok(storedUser.refreshTokenHash);
  assert.notEqual(storedUser.emailVerificationOtpHash, verificationOtp);
  assert.equal(storedUser.emailVerificationOtpHash, hashOtp('email-verification', storedUser._id.toString(), verificationOtp, config.otpHashSecret));
  assert.notEqual(storedUser.emailVerificationOtpHash, hashOtp('password-reset', storedUser._id.toString(), verificationOtp, config.otpHashSecret));

  const resendDuringCooldown = await request('/api/auth/resend-verification', {
    method: 'POST',
    cookie: signupCookies,
  });
  assert.equal(resendDuringCooldown.status, 202);
  assert.match((await resendDuringCooldown.json()).data.message, /wait before requesting/i);

  const deliveryFailure = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Pending User', username: 'pending_user', email: failedEmail, password: 'test-password-1' },
  });
  assert.equal(deliveryFailure.status, 201);
  const deliveryFailureBody = await deliveryFailure.json();
  assert.equal(deliveryFailureBody.data.verificationEmailSent, false);
  assert.match(deliveryFailureBody.data.message, /email delivery is unavailable/i);
  const failedSignupCookies = cookiesFor(deliveryFailure.headers.getSetCookie());
  let failedUser = await User.findOne({ email: failedEmail }).select('+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationLastSentAt');
  assert.equal(failedUser.emailVerificationOtpHash, null);
  assert.equal(failedUser.emailVerificationOtpExpiresAt, null);
  assert.equal(failedUser.emailVerificationLastSentAt, null);
  failedEmails.delete(failedEmail);
  const retriedDelivery = await request('/api/auth/resend-verification', { method: 'POST', cookie: failedSignupCookies });
  assert.equal(retriedDelivery.status, 202);
  assert.match((await retriedDelivery.json()).data.message, /new code was sent/i);
  failedUser = await User.findOne({ email: failedEmail }).select('+emailVerificationOtpHash +emailVerificationLastSentAt');
  assert.ok(failedUser.emailVerificationOtpHash);
  assert.ok(failedUser.emailVerificationLastSentAt);

  const duplicateUsername = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Another Wolf', username: 'WOLF_LINK_01', email: `other-${randomUUID()}@example.invalid`, password: 'test-password-1' },
  });
  assert.equal(duplicateUsername.status, 409);
  assert.equal((await duplicateUsername.json()).error.code, 'USERNAME_IN_USE');

  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Wolf Link', username: 'wolf_link_01', email, password: 'test-password-1' },
  });
  assert.equal(duplicate.status, 409);

  const wrongPassword = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'incorrect-password' },
  });
  assert.equal(wrongPassword.status, 401);

  const unverifiedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'test-password-1' },
  });
  assert.equal(unverifiedLogin.status, 200);

  const incorrectOtp = await request('/api/auth/verify-email', {
    method: 'POST',
    cookie: signupCookies,
    body: { otp: '000000' === verificationOtp ? '000001' : '000000' },
  });
  assert.equal(incorrectOtp.status, 400);

  const verified = await request('/api/auth/verify-email', {
    method: 'POST',
    cookie: signupCookies,
    body: { otp: verificationOtp },
  });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).data.message, 'Email verified. You can now start a conversation.');
  storedUser = await User.findOne({ email }).select('+emailVerificationOtpHash +emailVerificationOtpExpiresAt');
  assert.equal(storedUser.emailVerified, true);
  assert.equal(storedUser.emailVerificationOtpHash, null);
  assert.equal(storedUser.emailVerificationOtpExpiresAt, null);

  const reusedOtp = await request('/api/auth/verify-email', {
    method: 'POST',
    cookie: signupCookies,
    body: { otp: verificationOtp },
  });
  assert.equal(reusedOtp.status, 400);

  const signedIn = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'test-password-1' },
  });
  assert.equal(signedIn.status, 200);
  const loginCookies = signedIn.headers.getSetCookie();
  const me = await request('/api/auth/me', { cookie: cookiesFor(loginCookies) });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).data.user.email, email);

  const oldRefresh = cookiesFor(loginCookies, ['wl_refresh']);
  const refreshed = await request('/api/auth/refresh', { method: 'POST', cookie: oldRefresh });
  assert.equal(refreshed.status, 200);
  const newRefresh = cookiesFor(refreshed.headers.getSetCookie(), ['wl_refresh']);
  assert.notEqual(newRefresh, oldRefresh);
  const refreshedSession = await request('/api/auth/me', {
    cookie: cookiesFor(refreshed.headers.getSetCookie()),
  });
  assert.equal(refreshedSession.status, 200);

  const reused = await request('/api/auth/refresh', { method: 'POST', cookie: oldRefresh });
  assert.equal(reused.status, 401);

  const loggedOut = await request('/api/auth/logout', { method: 'POST', cookie: newRefresh });
  assert.equal(loggedOut.status, 200);
  const afterLogout = await request('/api/auth/refresh', { method: 'POST', cookie: newRefresh });
  assert.equal(afterLogout.status, 401);

  const clearedUser = await User.findOne({ email }).select('+refreshTokenHash');
  assert.equal(clearedUser.refreshTokenHash, null);

  let lastLoginAttempt;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    lastLoginAttempt = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'incorrect-password' },
    });
  }
  assert.equal(lastLoginAttempt.status, 429);
  assert.equal((await lastLoginAttempt.json()).error.code, 'RATE_LIMITED');
  assert.ok(loginCookies.some((value) => value.startsWith('wl_access=')));
  assert.ok(loginCookies.some((value) => value.startsWith('wl_refresh=')));
});
