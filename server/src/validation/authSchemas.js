import Joi from 'joi';

const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254).required();
const password = Joi.string().min(8).max(72).required();

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(40).required(),
  username: Joi.string().trim().lowercase().pattern(/^[a-z0-9_]{3,24}$/).required().messages({
    'string.pattern.base': 'Username must use 3–24 letters, numbers, or underscores.',
  }),
  email,
  password,
  phone: Joi.string().trim().max(32).allow('').optional(),
}).required();

export const loginSchema = Joi.object({
  identifier: Joi.string().trim().min(1).max(254),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254),
  password: Joi.string().min(1).max(72).required(),
}).xor('identifier', 'email').required();

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(72).required(),
  newPassword: Joi.string().min(8).max(72).required(),
}).required();

export const emailSchema = Joi.object({ email }).required();

export const verifyEmailSchema = Joi.object({
  otp: Joi.string().pattern(/^\d{6}$/).required(),
}).required();

export const resetRequestSchema = Joi.object({ email }).required();
export const resetOtpSchema = Joi.object({ email, otp: Joi.string().pattern(/^\d{6}$/).required() }).required();
export const passwordResetSchema = Joi.object({
  email,
  resetToken: Joi.string().min(32).max(128).required(),
  password: Joi.string().min(8).max(72).required(),
}).required();

export const profileUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(40),
  username: Joi.string().trim().lowercase().pattern(/^[a-z0-9_]{3,24}$/),
  bio: Joi.string().trim().max(160),
  phone: Joi.string().trim().max(32).allow(''),
  isPhonePublic: Joi.boolean(),
}).min(1).required();
