import { Router } from "express";
import express from "express";
import { rateLimit } from "express-rate-limit";
import * as conversationController from "../controllers/conversationController.js";
import {
  requireAuth,
  requireVerifiedEmail,
} from "../middleware/requireAuth.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";
import { validateBody } from "../middleware/validateBody.js";
import Joi from "joi";

const createConversationSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
}).required();
const sendMessageSchema = Joi.object({
  text: Joi.string().trim().min(1).max(4000).required(),
  clientMessageId: Joi.string()
    .pattern(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    .required(),
}).required();
const readMarkerSchema = Joi.object({
  lastReadMessageId: Joi.string().hex().length(24).optional(),
}).default({});
const preferencesSchema = Joi.object({
  isMuted: Joi.boolean(),
  isPinned: Joi.boolean(),
})
  .min(1)
  .required();
const messageWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export function conversationRoutes(config) {
  const router = Router();
  router.use(
    requireTrustedOrigin(config.clientOrigin),
    requireAuth(config),
    requireVerifiedEmail(),
  );
  router.get("/", conversationController.list);
  router.post(
    "/",
    validateBody(createConversationSchema),
    conversationController.create,
  );
  router.get("/:id/messages", conversationController.messages);
  router.post(
    "/:id/messages",
    messageWriteLimiter,
    validateBody(sendMessageSchema),
    conversationController.sendMessage,
  );
  router.post(
    "/:id/attachments",
    messageWriteLimiter,
    express.raw({
      type: ["image/jpeg", "image/png", "image/webp"],
      limit: "10mb",
    }),
    conversationController.uploadImageAttachment(config),
  );
  router.delete(
    "/:id/messages/:messageId",
    messageWriteLimiter,
    conversationController.deleteMessage,
  );
  router.post(
    "/:id/read",
    validateBody(readMarkerSchema),
    conversationController.markRead,
  );
  router.patch(
    "/:id/preferences",
    validateBody(preferencesSchema),
    conversationController.updatePreferences,
  );
  router.get("/:id", conversationController.get);
  return router;
}
