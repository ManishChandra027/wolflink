import Joi from 'joi';

export const socketMessageSchema = Joi.object({
  conversationId: Joi.string().hex().length(24).required(),
  text: Joi.string().trim().min(1).max(4000).required(),
  clientMessageId: Joi.string().pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).required(),
}).required();

export const socketReadSchema = Joi.object({
  conversationId: Joi.string().hex().length(24).required(),
  lastReadMessageId: Joi.string().hex().length(24).optional(),
}).required();
