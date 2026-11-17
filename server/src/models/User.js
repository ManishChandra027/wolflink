import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 40,
  },
  username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 24,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  },
  phone: {
    type: String,
    default: undefined,
    trim: true,
    maxlength: 16,
  },
  isPhonePublic: {
    type: Boolean,
    default: false,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  emailVerified: {
    type: Boolean,
    default: false,
    index: true,
  },
  emailVerificationOtpHash: {
    type: String,
    default: null,
    select: false,
  },
  emailVerificationOtpExpiresAt: {
    type: Date,
    default: null,
    select: false,
  },
  emailVerificationOtpAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  emailVerificationLastSentAt: {
    type: Date,
    default: null,
    select: false,
  },
  passwordResetOtpHash: {
    type: String,
    default: null,
    select: false,
  },
  passwordResetOtpExpiresAt: {
    type: Date,
    default: null,
    select: false,
  },
  passwordResetOtpAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  passwordResetLastSentAt: {
    type: Date,
    default: null,
    select: false,
  },
  passwordResetTokenHash: {
    type: String,
    default: null,
    select: false,
  },
  passwordResetTokenExpiresAt: {
    type: Date,
    default: null,
    select: false,
  },
  avatar: {
    type: String,
    default: '',
    maxlength: 2048,
  },
  bio: {
    type: String,
    default: '',
    maxlength: 160,
  },
  refreshTokenHash: {
    type: String,
    default: null,
    select: false,
  },
  lastSeen: {
    type: Date,
    default: null,
  },
  blockedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });

export const User = mongoose.model('User', userSchema);
