import mongoose from 'mongoose';
import { HttpError } from '../errors/HttpError.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { assertConversationMessageAllowed, getConversation } from './conversationService.js';

function toMessage(message) {
  return {
    id: message._id.toString(),
    conversationId: message.conversationId.toString(),
    senderId: message.senderId.toString(),
    clientMessageId: message.clientMessageId,
    type: message.type,
    text: message.text,
    attachment: message.attachment?.url ? message.attachment : null,
    deletedAt: message.deletedAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

function encodeCursor(message) {
  return Buffer.from(JSON.stringify({ id: message._id.toString(), createdAt: message.createdAt.toISOString() })).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!mongoose.isValidObjectId(value.id) || !Number.isFinite(Date.parse(value.createdAt))) throw new Error('Invalid cursor');
    return { id: new mongoose.Types.ObjectId(value.id), createdAt: new Date(value.createdAt) };
  } catch {
    throw new HttpError(400, 'INVALID_CURSOR', 'That history cursor is invalid. Refresh the conversation and try again.');
  }
}

async function assertConversationAccess(userId, conversationId) {
  return getConversation(userId, conversationId);
}

export async function listMessages(userId, conversationId, { before, limit = 30 } = {}) {
  await assertConversationAccess(userId, conversationId);
  const pageSize = Math.max(1, Math.min(Number.parseInt(limit, 10) || 30, 50));
  const cursor = decodeCursor(before);
  const filter = { conversationId };
  if (cursor) {
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ];
  }
  const descending = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(pageSize + 1).lean();
  const hasMore = descending.length > pageSize;
  const page = descending.slice(0, pageSize);
  const nextCursor = hasMore && page.length ? encodeCursor(page.at(-1)) : null;
  return { messages: page.reverse().map(toMessage), nextCursor, hasMore };
}

export async function sendTextMessage(userId, conversationId, { text, clientMessageId }) {
  await assertConversationMessageAllowed(userId, conversationId);
  let message;
  try {
    message = await Message.create({ conversationId, senderId: userId, clientMessageId, type: 'text', text: text.trim() });
  } catch (error) {
    if (error.code !== 11000) throw error;
    message = await Message.findOne({ conversationId, senderId: userId, clientMessageId });
    if (!message) throw error;
  }
  await Conversation.updateOne({ _id: conversationId, participants: userId }, { $max: { lastActivityAt: message.createdAt } });
  return toMessage(message);
}

export async function sendImageMessage(userId, conversationId, { clientMessageId, attachment, text = '' }) {
  await assertConversationMessageAllowed(userId, conversationId);
  let message;
  try {
    message = await Message.create({ conversationId, senderId: userId, clientMessageId, type: 'image', text: text.trim(), attachment });
  } catch (error) {
    if (error.code !== 11000) throw error;
    message = await Message.findOne({ conversationId, senderId: userId, clientMessageId });
    if (!message) throw error;
  }
  await Conversation.updateOne({ _id: conversationId, participants: userId }, { $max: { lastActivityAt: message.createdAt } });
  return toMessage(message);
}

export async function markConversationRead(userId, conversationId, requestedMessageId) {
  await assertConversationAccess(userId, conversationId);
  const latest = requestedMessageId
    ? await Message.findOne({ _id: requestedMessageId, conversationId }).select('_id createdAt').lean()
    : await Message.findOne({ conversationId }).sort({ createdAt: -1, _id: -1 }).select('_id createdAt').lean();
  if (requestedMessageId && !latest) throw new HttpError(400, 'INVALID_READ_MARKER', 'That message is not in this conversation.');
  const lastReadAt = latest?.createdAt || new Date(0);
  const lastReadMessageId = latest?._id || null;
  const updated = await Conversation.findOneAndUpdate(
    { _id: conversationId, participants: userId, 'readStates.userId': userId },
    { $set: { 'readStates.$.lastReadAt': lastReadAt, 'readStates.$.lastReadMessageId': lastReadMessageId } },
  );
  if (!updated) {
    await Conversation.updateOne(
      { _id: conversationId, participants: userId, 'readStates.userId': { $ne: userId } },
      { $push: { readStates: { userId, lastReadAt, lastReadMessageId } } },
    );
  }
  return { lastReadAt, lastReadMessageId: lastReadMessageId?.toString() || null };
}

export async function deleteOwnMessage(userId, conversationId, messageId) {
  await assertConversationAccess(userId, conversationId);
  const message = await Message.findOne({ _id: messageId, conversationId });
  if (!message) throw new HttpError(404, 'MESSAGE_NOT_FOUND', 'This message could not be found.');
  if (message.senderId.toString() !== userId) throw new HttpError(403, 'CANNOT_DELETE_MESSAGE', 'You can only delete your own messages.');
  if (message.type === 'deleted') return toMessage(message);
  message.type = 'deleted';
  message.text = '';
  message.attachment = undefined;
  message.deletedAt = new Date();
  await message.save();
  return toMessage(message);
}

export function conversationRoom(conversationId) {
  return `conversation:${conversationId}`;
}
