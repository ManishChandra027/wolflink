import { rateLimit } from 'express-rate-limit';
import express from 'express';
import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js';
import { validateBody } from '../middleware/validateBody.js';
import { profileUpdateSchema } from '../validation/authSchemas.js';
import Joi from 'joi';

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
const reportSchema = Joi.object({
  reason: Joi.string().valid('spam', 'harassment', 'impersonation', 'inappropriate', 'other').required(),
  details: Joi.string().trim().max(1000).allow('').default(''),
}).required();

export function userRoutes(config) {
  const router = Router();
  router.use(requireTrustedOrigin(config.clientOrigin), requireAuth(config));
  router.get('/me', userController.getMe);
  router.post('/me/avatar', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), userController.uploadAvatar(config));
  router.delete('/me/avatar', userController.deleteAvatar);
  router.patch('/me', validateBody(profileUpdateSchema), userController.patchMe);
  router.get('/me/blocked', userController.listBlockedUsers);
  router.post('/:userId/block', userController.blockUser);
  router.delete('/:userId/block', userController.unblockUser);
  router.post('/:userId/report', reportLimiter, validateBody(reportSchema), userController.reportUser);
  router.get('/search', searchLimiter, userController.search);
  router.get('/:userId', userController.getPublicProfile);
  return router;
}
