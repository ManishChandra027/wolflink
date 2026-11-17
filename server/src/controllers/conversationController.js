import * as conversationService from '../services/conversationService.js';
import * as messageService from '../services/messageService.js';
import { createHash, randomUUID } from 'node:crypto';
import { assertConversationMessageAllowed } from '../services/conversationService.js';
import { HttpError } from '../errors/HttpError.js';

const attachmentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function create(req, res) {
  const conversation = await conversationService.createOrGetConversation(req.auth.userId, req.body.userId);
  res.status(200).json({ data: { conversation } });
}

export async function list(req, res) {
  res.json({ data: { conversations: await conversationService.listConversations(req.auth.userId) } });
}

export async function get(req, res) {
  res.json({ data: { conversation: await conversationService.getConversation(req.auth.userId, req.params.id) } });
}

export async function messages(req, res) {
  res.json({ data: await messageService.listMessages(req.auth.userId, req.params.id, req.query) });
}

export async function sendMessage(req, res) {
  const message = await messageService.sendTextMessage(req.auth.userId, req.params.id, req.body);
  const io = req.app.get('io');
  io?.to(messageService.conversationRoom(req.params.id)).emit('message:new', message);
  const conversation = await conversationService.getConversation(req.auth.userId, req.params.id);
  const peerId = conversation.participants.find((person) => person.id !== req.auth.userId)?.id;
  if (peerId) io?.to(`user:${peerId}`).emit('message:notification', message);
  res.status(201).json({ data: { message } });
}

export async function markRead(req, res) {
  const result = await messageService.markConversationRead(req.auth.userId, req.params.id, req.body?.lastReadMessageId);
  req.app.get('io')?.to(messageService.conversationRoom(req.params.id)).emit('message:read', { conversationId: req.params.id, userId: req.auth.userId, ...result });
  res.json({ data: result });
}

export async function deleteMessage(req, res) {
  const message = await messageService.deleteOwnMessage(req.auth.userId, req.params.id, req.params.messageId);
  req.app.get('io')?.to(messageService.conversationRoom(req.params.id)).emit('message:update', message);
  res.json({ data: { message } });
}

export async function updatePreferences(req, res) {
  const conversation = await conversationService.updateConversationPreferences(req.auth.userId, req.params.id, req.body);
  res.json({ data: { conversation } });
}

export function uploadImageAttachment(config) {
  return async (req, res) => {
    const conversation = await assertConversationMessageAllowed(req.auth.userId, req.params.id);
    if (!config.cloudinaryCloudName) throw new HttpError(503, 'ATTACHMENTS_NOT_CONFIGURED', 'Image attachments are not configured yet.');
    if (!attachmentTypes.has(req.headers['content-type'])) throw new HttpError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Choose a JPG, PNG, or WebP image.');
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > 10 * 1024 * 1024) throw new HttpError(413, 'INVALID_IMAGE_SIZE', 'Choose an image smaller than 10 MB.');
    const clientMessageId = req.query.clientMessageId;
    if (typeof clientMessageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientMessageId)) throw new HttpError(400, 'INVALID_MESSAGE_ID', 'Refresh the attachment and try again.');
    const caption = typeof req.query.caption === 'string' ? req.query.caption.trim() : '';
    if (caption.length > 4000) throw new HttpError(400, 'INVALID_CAPTION', 'Image captions must be 4,000 characters or fewer.');

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = `wolflink/messages/${req.params.id}`;
    const publicId = `message_${clientMessageId}`;
    const params = { folder, overwrite: 'true', public_id: publicId, timestamp };
    const signatureInput = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
    const signature = createHash('sha1').update(`${signatureInput}${config.cloudinaryApiSecret}`).digest('hex');
    const body = new FormData();
    body.append('file', new Blob([req.body], { type: req.headers['content-type'] }), `attachment-${randomUUID()}`);
    body.append('api_key', config.cloudinaryApiKey);
    for (const [key, value] of Object.entries(params)) body.append(key, value);
    body.append('signature', signature);
    let response;
    try { response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/image/upload`, { method: 'POST', body }); }
    catch { throw new HttpError(502, 'ATTACHMENT_UPLOAD_FAILED', 'Could not upload the image. Retry when your connection is stable.'); }
    let uploaded;
    try { uploaded = await response.json(); } catch { throw new HttpError(502, 'ATTACHMENT_UPLOAD_FAILED', 'Image storage returned an unreadable response.'); }
    if (!response.ok || typeof uploaded.secure_url !== 'string') throw new HttpError(502, 'ATTACHMENT_UPLOAD_FAILED', 'Image storage could not accept the image. Check Cloudinary configuration and retry.');
    const message = await messageService.sendImageMessage(req.auth.userId, req.params.id, {
      clientMessageId,
      text: caption,
      attachment: { url: uploaded.secure_url, publicId: uploaded.public_id, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, format: uploaded.format },
    });
    const io = req.app.get('io');
    io?.to(messageService.conversationRoom(req.params.id)).emit('message:new', message);
    const peerId = conversation.participants.find((person) => person.id !== req.auth.userId)?.id;
    if (peerId) io?.to(`user:${peerId}`).emit('message:notification', message);
    res.status(201).json({ data: { message } });
  };
}
