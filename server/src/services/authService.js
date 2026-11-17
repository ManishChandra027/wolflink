import bcrypt from 'bcryptjs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../errors/HttpError.js';
import { User } from '../models/User.js';
import { sendVerificationEmail } from './emailService.js';
import { generateOtp, hashOtp, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from './otpService.js';
import {
  createTokenPair,
  hashToken,
  verifyAnyRefreshToken,
  verifyRefreshToken,
} from './tokenService.js';

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username || '',
    email: user.email,
    emailVerified: user.emailVerified,
    avatar: user.avatar,
    bio: user.bio,
  };
}

function ensureBcryptLength(password) {
  if (bcrypt.truncates(password)) {
    throw new HttpError(400, 'PASSWORD_TOO_LONG', 'Password must be no more than 72 UTF-8 bytes.');
  }
}

async function persistNewSession(user, config) {
  const tokens = createTokenPair(user._id.toString(), config);
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save();
  return { user: toOwnUser(user), ...tokens };
}

export function normalizePhone(phone) {
  if (!phone?.trim()) return undefined;
  const normalized = phone.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new HttpError(400, 'INVALID_PHONE', 'Enter a valid international phone number, such as +91 98765 43210.');
  }
  return normalized;
}

export function toOwnUser(user) {
  return { ...toPublicUser(user), phone: user.phone || '', isPhonePublic: user.isPhonePublic === true };
}

export async function register({ name, username, email, password, phone }, config, sendEmail = sendVerificationEmail) {
  ensureBcryptLength(password);
  const existing = await User.exists({ email });
  if (existing) throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  const normalizedUsername = username.trim().toLowerCase();
  if (await User.exists({ username: normalizedUsername })) throw new HttpError(409, 'USERNAME_IN_USE', 'That username is already taken. Choose another one.');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = new User({ name, username: normalizedUsername, email, phone: normalizePhone(phone), passwordHash, emailVerified: false, isPhonePublic: false });
  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.phone) throw new HttpError(409, 'PHONE_IN_USE', 'That phone number is already connected to an account.');
      if (error.keyPattern?.username) throw new HttpError(409, 'USERNAME_IN_USE', 'That username is already taken. Choose another one.');
      throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }
    throw error;
  }
  const session = await persistNewSession(user, config);
  let verificationEmailSent = true;
  try {
    await issueEmailVerification(user, config, sendEmail);
  } catch (error) {
    verificationEmailSent = false;
  }
  return { ...session, email: user.email, verificationEmailSent };
}

async function issueEmailVerification(user, config, sendEmail) {
  const otp = generateOtp();
  const now = new Date();
  const otpHash = hashOtp('email-verification', user._id.toString(), otp, config.otpHashSecret);
  user.emailVerificationOtpHash = otpHash;
  user.emailVerificationOtpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);
  user.emailVerificationOtpAttempts = 0;
  user.emailVerificationLastSentAt = now;
  await user.save();
  try {
    await sendEmail(config, { to: user.email, otp });
  } catch (error) {
    await User.updateOne({ _id: user._id, emailVerificationOtpHash: otpHash }, {
      $set: { emailVerificationOtpHash: null, emailVerificationOtpExpiresAt: null, emailVerificationOtpAttempts: 0, emailVerificationLastSentAt: null },
    });
    throw error;
  }
}

export async function resendEmailVerification(userId, config, sendEmail = sendVerificationEmail) {
  const user = await User.findById(userId).select('+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts +emailVerificationLastSentAt');
  if (!user || user.emailVerified) throw new HttpError(400, 'EMAIL_ALREADY_VERIFIED', 'This email address is already verified.');

  const cooldownEnd = user.emailVerificationLastSentAt?.getTime() + OTP_RESEND_COOLDOWN_MS;
  if (cooldownEnd && cooldownEnd > Date.now()) {
    return { message: 'If the account needs verification, wait before requesting another code.' };
  }

  await issueEmailVerification(user, config, sendEmail);
  return { message: 'If the account needs verification, a new code was sent.' };
}

export async function verifyEmail(userId, { otp }, config) {
  const user = await User.findById(userId).select('+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts');
  const invalid = () => new HttpError(400, 'INVALID_OR_EXPIRED_CODE', 'That verification code is invalid or expired. Request a new code and try again.');
  if (!user || user.emailVerified || !user.emailVerificationOtpHash) throw invalid();

  const now = new Date();
  if (user.emailVerificationOtpExpiresAt <= now || user.emailVerificationOtpAttempts >= OTP_MAX_ATTEMPTS) {
    await User.updateOne(
      { _id: user._id, emailVerificationOtpHash: user.emailVerificationOtpHash },
      { $set: { emailVerificationOtpHash: null, emailVerificationOtpExpiresAt: null } },
    );
    throw invalid();
  }

  const expected = Buffer.from(user.emailVerificationOtpHash, 'hex');
  const supplied = Buffer.from(hashOtp('email-verification', user._id.toString(), otp, config.otpHashSecret), 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    const update = { $inc: { emailVerificationOtpAttempts: 1 } };
    if (user.emailVerificationOtpAttempts + 1 >= OTP_MAX_ATTEMPTS) {
      update.$set = { emailVerificationOtpHash: null, emailVerificationOtpExpiresAt: null };
    }
    await User.updateOne(
      { _id: user._id, emailVerificationOtpHash: user.emailVerificationOtpHash, emailVerificationOtpAttempts: user.emailVerificationOtpAttempts },
      update,
    );
    throw invalid();
  }

  const result = await User.updateOne(
    {
      _id: user._id,
      emailVerified: false,
      emailVerificationOtpHash: user.emailVerificationOtpHash,
      emailVerificationOtpExpiresAt: { $gt: now },
      emailVerificationOtpAttempts: { $lt: OTP_MAX_ATTEMPTS },
    },
    {
      $set: { emailVerified: true, emailVerificationOtpHash: null, emailVerificationOtpExpiresAt: null, emailVerificationOtpAttempts: 0 },
    },
  );
  if (result.modifiedCount !== 1) throw invalid();
  return { message: 'Email verified. You can now start a conversation.', user: toOwnUser(await User.findById(user._id)) };
}

export async function login({ identifier, email, password }, config) {
  ensureBcryptLength(password);
  const loginValue = (identifier || email || '').trim();
  let lookup;
  if (loginValue.startsWith('+')) {
    try { lookup = { phone: normalizePhone(loginValue) }; } catch { lookup = { phone: loginValue }; }
  } else if (loginValue.includes('@')) {
    lookup = { email: loginValue.toLowerCase() };
  } else {
    lookup = { username: loginValue.toLowerCase() };
  }
  const user = await User.findOne(lookup).select('+passwordHash +refreshTokenHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Login details are incorrect.');
  }
  return persistNewSession(user, config);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  ensureBcryptLength(currentPassword);
  ensureBcryptLength(newPassword);
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'CURRENT_PASSWORD_INCORRECT', 'Your current password is incorrect.');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.refreshTokenHash = null;
  await user.save();
  return { message: 'Password changed. Please sign in again.' };
}

export async function refreshSession(token, config) {
  if (!token) throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again.');

  let payload;
  try {
    payload = verifyRefreshToken(token, config);
  } catch {
    throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again.');
  }

  const oldHash = hashToken(token);
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== oldHash) {
    throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again.');
  }

  const tokens = createTokenPair(user._id.toString(), config);
  const result = await User.updateOne(
    { _id: user._id, refreshTokenHash: oldHash },
    { $set: { refreshTokenHash: hashToken(tokens.refreshToken) } },
  );
  if (result.modifiedCount !== 1) {
    throw new HttpError(401, 'SESSION_EXPIRED', 'This session has already been refreshed. Please sign in again.');
  }

  return { user: toOwnUser(user), ...tokens };
}

export async function logout(token, config) {
  if (!token) return;
  const payload = verifyAnyRefreshToken(token, config);
  if (!payload) return;
  await User.updateOne(
    { _id: payload.sub, refreshTokenHash: hashToken(token) },
    { $set: { refreshTokenHash: null } },
  );
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  return toOwnUser(user);
}

export async function assertEmailVerified(userId) {
  const user = await User.findById(userId).select('emailVerified');
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  if (!user.emailVerified) throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email in Account Settings before starting a conversation.');
  return user;
}

export async function updateOwnProfile(userId, changes) {
  const updates = {};
  if (changes.name !== undefined) updates.name = changes.name.trim();
  if (changes.username !== undefined) updates.username = changes.username.trim().toLowerCase();
  if (changes.bio !== undefined) updates.bio = changes.bio.trim();
  const unset = {};
  if (changes.phone !== undefined) {
    const phone = normalizePhone(changes.phone);
    if (phone) updates.phone = phone;
    else {
      unset.phone = 1;
      updates.isPhonePublic = false;
    }
  }
  if (changes.isPhonePublic !== undefined && changes.phone?.trim()) updates.isPhonePublic = changes.isPhonePublic;
  else if (changes.isPhonePublic !== undefined && changes.phone === undefined) updates.isPhonePublic = changes.isPhonePublic;
  try {
    const update = { $set: updates };
    if (Object.keys(unset).length) update.$unset = unset;
    const user = await User.findByIdAndUpdate(userId, update, { returnDocument: 'after', runValidators: true });
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'This account could not be found.');
    return toOwnUser(user);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.phone) throw new HttpError(409, 'PHONE_IN_USE', 'That phone number is already connected to an account.');
    if (error.code === 11000 && error.keyPattern?.username) throw new HttpError(409, 'USERNAME_IN_USE', 'That username is already taken.');
    throw error;
  }
}

export async function searchUsers({ query, phone, userId }) {
  let excludedIds = userId ? [userId] : [];
  if (userId) {
    const [currentUser, blockers] = await Promise.all([
      User.findById(userId).select('blockedUserIds').lean(),
      User.find({ blockedUserIds: userId }).select('_id').lean(),
    ]);
    excludedIds = [...excludedIds, ...(currentUser?.blockedUserIds || []), ...blockers.map((entry) => entry._id)];
  }
  if (phone) {
    const normalized = normalizePhone(phone);
    const user = await User.findOne({ _id: { $nin: excludedIds }, phone: normalized, isPhonePublic: true, emailVerified: true }).select('name phone isPhonePublic avatar bio emailVerified');
    return user ? [{ id: user._id.toString(), name: user.name, phone: user.phone, avatar: user.avatar, bio: user.bio, emailVerified: user.emailVerified }] : [];
  }
  const value = query.trim().slice(0, 50);
  if (!value) return [];
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({ _id: { $nin: excludedIds }, emailVerified: true, $or: [{ name: { $regex: escaped, $options: 'i' } }, { username: { $regex: escaped, $options: 'i' } }] }).select('name username avatar bio emailVerified').sort({ name: 1 }).limit(20).lean();
  return users.map((user) => ({ id: user._id.toString(), name: user.name, username: user.username || '', avatar: user.avatar, bio: user.bio, emailVerified: user.emailVerified }));
}

export async function getPublicProfile(userId) {
  if (!/^[a-f\d]{24}$/i.test(userId)) throw new HttpError(404, 'USER_NOT_FOUND', 'This profile is unavailable.');
  const user = await User.findOne({ _id: userId, emailVerified: true }).select('name username avatar bio phone isPhonePublic').lean();
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'This profile is unavailable.');
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    avatar: user.avatar || '',
    bio: user.bio || '',
    phone: user.isPhonePublic ? user.phone || '' : '',
  };
}

export async function setAvatar(userId, avatarUrl) {
  const user = await User.findByIdAndUpdate(userId, { $set: { avatar: avatarUrl } }, { returnDocument: 'after', runValidators: true });
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'This account could not be found.');
  return toOwnUser(user);
}

export async function requestPasswordReset(email, config, sendEmail) {
  const generic = { message: 'If an account exists for that email, a reset code will be sent.' };
  const user = await User.findOne({ email }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts +passwordResetLastSentAt');
  if (!user) return generic;
  const lastSent = user.passwordResetLastSentAt?.getTime();
  if (lastSent && Date.now() - lastSent < OTP_RESEND_COOLDOWN_MS) return generic;
  const otp = generateOtp();
  const now = new Date();
  const otpHash = hashOtp('password-reset', user._id.toString(), otp, config.otpHashSecret);
  user.passwordResetOtpHash = otpHash;
  user.passwordResetOtpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);
  user.passwordResetOtpAttempts = 0;
  user.passwordResetLastSentAt = now;
  user.passwordResetTokenHash = null;
  user.passwordResetTokenExpiresAt = null;
  await user.save();
  try {
    await sendEmail(config, { to: user.email, otp });
  } catch (error) {
    await User.updateOne({ _id: user._id, passwordResetOtpHash: otpHash }, {
      $set: { passwordResetOtpHash: null, passwordResetOtpExpiresAt: null, passwordResetOtpAttempts: 0, passwordResetLastSentAt: null },
    });
    throw error;
  }
  return generic;
}

export async function verifyPasswordResetOtp({ email, otp }, config) {
  const user = await User.findOne({ email }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts');
  const invalid = () => new HttpError(400, 'INVALID_OR_EXPIRED_CODE', 'That reset code is invalid or expired. Request a new code and try again.');
  if (!user?.passwordResetOtpHash || !user.passwordResetOtpExpiresAt || user.passwordResetOtpExpiresAt <= new Date() || user.passwordResetOtpAttempts >= OTP_MAX_ATTEMPTS) throw invalid();
  const expected = Buffer.from(user.passwordResetOtpHash, 'hex');
  const supplied = Buffer.from(hashOtp('password-reset', user._id.toString(), otp, config.otpHashSecret), 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    const update = { $inc: { passwordResetOtpAttempts: 1 } };
    if (user.passwordResetOtpAttempts + 1 >= OTP_MAX_ATTEMPTS) update.$set = { passwordResetOtpHash: null, passwordResetOtpExpiresAt: null };
    await User.updateOne({ _id: user._id, passwordResetOtpHash: user.passwordResetOtpHash, passwordResetOtpAttempts: user.passwordResetOtpAttempts }, update);
    throw invalid();
  }
  const resetToken = randomBytes(32).toString('base64url');
  const now = new Date();
  const result = await User.updateOne({ _id: user._id, passwordResetOtpHash: user.passwordResetOtpHash, passwordResetOtpExpiresAt: { $gt: now }, passwordResetOtpAttempts: { $lt: OTP_MAX_ATTEMPTS } }, {
    $set: { passwordResetOtpHash: null, passwordResetOtpExpiresAt: null, passwordResetOtpAttempts: 0, passwordResetTokenHash: hashToken(resetToken), passwordResetTokenExpiresAt: new Date(now.getTime() + 10 * 60 * 1000) },
  });
  if (result.modifiedCount !== 1) throw invalid();
  return { resetToken, message: 'Code verified. Choose a new password.' };
}

export async function resetPassword({ email, resetToken, password }) {
  ensureBcryptLength(password);
  const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetTokenExpiresAt');
  if (!user?.passwordResetTokenHash || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt <= new Date() || user.passwordResetTokenHash !== hashToken(resetToken)) {
    throw new HttpError(400, 'INVALID_OR_EXPIRED_RESET_TOKEN', 'This password reset request is invalid or expired. Request a new code.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne({ _id: user._id, passwordResetTokenHash: hashToken(resetToken), passwordResetTokenExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash, refreshTokenHash: null, passwordResetTokenHash: null, passwordResetTokenExpiresAt: null, passwordResetLastSentAt: null },
  });
  if (result.modifiedCount !== 1) throw new HttpError(400, 'INVALID_OR_EXPIRED_RESET_TOKEN', 'This password reset request is invalid or expired. Request a new code.');
  return { message: 'Password updated. Sign in with your new password.' };
}
