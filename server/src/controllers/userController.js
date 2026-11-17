import { HttpError } from '../errors/HttpError.js';
import * as authService from '../services/authService.js';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AbuseReport } from '../models/AbuseReport.js';

const avatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function getMe(req, res) {
  res.json({ data: { user: await authService.getCurrentUser(req.auth.userId) } });
}

export async function patchMe(req, res) {
  res.json({ data: { user: await authService.updateOwnProfile(req.auth.userId, req.body) } });
}

export async function search(req, res) {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const phone = typeof req.query.phone === 'string' ? req.query.phone : '';
  if (query.length > 50 || phone.length > 32 || (!query && !phone)) {
    throw new HttpError(400, 'INVALID_SEARCH', 'Enter a name or an international phone number to search.');
  }
  res.json({ data: { users: await authService.searchUsers({ query, phone, userId: req.auth.userId }) } });
}

export async function getPublicProfile(req, res) {
  res.json({ data: { user: await authService.getPublicProfile(req.params.userId) } });
}

function validateOtherUser(req) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(400, 'INVALID_USER_ID', 'Choose a valid WolfLink member.');
  if (userId === req.auth.userId) throw new HttpError(400, 'SELF_ACTION_NOT_ALLOWED', 'You cannot apply this action to your own account.');
  return userId;
}

export async function blockUser(req, res) {
  const userId = validateOtherUser(req);
  if (!await User.exists({ _id: userId })) throw new HttpError(404, 'USER_NOT_FOUND', 'This person could not be found.');
  await User.updateOne({ _id: req.auth.userId }, { $addToSet: { blockedUserIds: userId } });
  const event = { blockedById: req.auth.userId, blockedUserId: userId, blocked: true };
  req.app.get('io')?.to(`user:${req.auth.userId}`).to(`user:${userId}`).emit('block:update', event);
  res.json({ data: { blocked: true } });
}

export async function unblockUser(req, res) {
  const userId = validateOtherUser(req);
  await User.updateOne({ _id: req.auth.userId }, { $pull: { blockedUserIds: userId } });
  const event = { blockedById: req.auth.userId, blockedUserId: userId, blocked: false };
  req.app.get('io')?.to(`user:${req.auth.userId}`).to(`user:${userId}`).emit('block:update', event);
  res.json({ data: { blocked: false } });
}

export async function listBlockedUsers(req, res) {
  const user = await User.findById(req.auth.userId).select('blockedUserIds').lean();
  const users = await User.find({ _id: { $in: user?.blockedUserIds || [] } }).select('name username avatar').lean();
  res.json({ data: { users: users.map((entry) => ({ id: entry._id.toString(), name: entry.name, username: entry.username, avatar: entry.avatar })) } });
}

export async function reportUser(req, res) {
  const userId = validateOtherUser(req);
  if (!await User.exists({ _id: userId })) throw new HttpError(404, 'USER_NOT_FOUND', 'This person could not be found.');
  const recent = await AbuseReport.exists({ reporterId: req.auth.userId, reportedUserId: userId, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
  if (recent) throw new HttpError(429, 'REPORT_ALREADY_SUBMITTED', 'You have already reported this person recently.');
  const report = await AbuseReport.create({ reporterId: req.auth.userId, reportedUserId: userId, reason: req.body.reason, details: req.body.details || '' });
  res.status(201).json({ data: { reportId: report._id.toString(), status: report.status } });
}

export function uploadAvatar(config) {
  return async (req, res) => {
    if (!config.cloudinaryCloudName) throw new HttpError(503, 'AVATAR_UPLOAD_NOT_CONFIGURED', 'Profile photo upload is not configured yet.');
    if (!avatarTypes.has(req.headers['content-type'])) throw new HttpError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Choose a JPG, PNG, or WebP image.');
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > 5 * 1024 * 1024) {
      throw new HttpError(413, 'INVALID_IMAGE_SIZE', 'Choose an image smaller than 5 MB.');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = { folder: 'wolflink/avatars', overwrite: 'true', public_id: req.auth.userId, timestamp };
    const signatureInput = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
    const signature = createHash('sha1').update(`${signatureInput}${config.cloudinaryApiSecret}`).digest('hex');
    const body = new FormData();
    body.append('file', new Blob([req.body], { type: req.headers['content-type'] }), 'avatar');
    body.append('api_key', config.cloudinaryApiKey);
    body.append('timestamp', timestamp);
    body.append('folder', params.folder);
    body.append('public_id', params.public_id);
    body.append('overwrite', params.overwrite);
    body.append('signature', signature);

    let response;
    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/image/upload`, { method: 'POST', body });
    } catch (error) {
      console.error(JSON.stringify({ event: 'avatar.upload_failed', stage: 'cloudinary_request', name: error.name }));
      throw new HttpError(502, 'AVATAR_UPLOAD_FAILED', 'Could not upload your profile photo. Please retry.');
    }
    let uploaded;
    try {
      uploaded = await response.json();
    } catch (error) {
      console.error(JSON.stringify({ event: 'avatar.upload_failed', stage: 'cloudinary_response', status: response.status, name: error.name }));
      throw new HttpError(502, 'AVATAR_UPLOAD_FAILED', 'Cloudinary returned an unreadable response. Please retry.');
    }
    if (!response.ok) {
      const providerCode = Number.isInteger(uploaded?.error?.http_code) ? uploaded.error.http_code : response.status;
      console.error(JSON.stringify({ event: 'avatar.upload_failed', stage: 'cloudinary_rejected', status: response.status, providerCode }));
      throw new HttpError(502, 'AVATAR_UPLOAD_FAILED', `Cloudinary rejected the image (error ${providerCode}). Check server Cloudinary credentials and retry.`);
    }
    if (typeof uploaded.secure_url !== 'string') {
      console.error(JSON.stringify({ event: 'avatar.upload_failed', stage: 'cloudinary_missing_url', status: response.status }));
      throw new HttpError(502, 'AVATAR_UPLOAD_FAILED', 'Cloudinary did not return the uploaded image URL. Please retry.');
    }
    let user;
    try {
      user = await authService.setAvatar(req.auth.userId, uploaded.secure_url);
    } catch (error) {
      console.error(JSON.stringify({ event: 'avatar.upload_failed', stage: 'database_save', name: error.name, code: error.code || null }));
      throw new HttpError(500, 'AVATAR_SAVE_FAILED', 'The image uploaded, but your profile could not be updated. Please retry.');
    }
    res.status(201).json({ data: { user } });
  };
}

export async function deleteAvatar(req, res) {
  res.json({ data: { user: await authService.setAvatar(req.auth.userId, '') } });
}
