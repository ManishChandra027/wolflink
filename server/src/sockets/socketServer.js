import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import * as conversationService from '../services/conversationService.js';
import * as messageService from '../services/messageService.js';
import { socketMessageSchema, socketReadSchema } from '../validation/socketSchemas.js';

const onlineSockets = new Map();
const accessCookieName = 'wl_access';
function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

function safeError(error) {
  return { code: error.code || 'SOCKET_REQUEST_FAILED', message: error.status && error.status < 500 ? error.message : 'That action could not be completed. Please try again.' };
}

function allowSocketEvent(socket, eventName, limit, windowMs = 60_000) {
  const now = Date.now();
  const prior = socket.data.eventTimes?.[eventName] || [];
  const recent = prior.filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    socket.data.eventTimes ??= {};
    socket.data.eventTimes[eventName] = recent;
    return false;
  }
  recent.push(now);
  socket.data.eventTimes ??= {};
  socket.data.eventTimes[eventName] = recent;
  return true;
}

function trackOnline(userId, socketId) {
  const sockets = onlineSockets.get(userId) || new Set();
  const wasOnline = sockets.size > 0;
  sockets.add(socketId);
  onlineSockets.set(userId, sockets);
  return !wasOnline;
}

function trackOffline(userId, socketId) {
  const sockets = onlineSockets.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size) return false;
  onlineSockets.delete(userId);
  return true;
}

async function publishPresence(io, userId, isOnline) {
  const conversations = await Conversation.find({ participants: userId }).select('_id').lean();
  for (const conversation of conversations) {
    io.to(messageService.conversationRoom(conversation._id.toString())).emit('presence:update', { userId, isOnline, lastSeen: isOnline ? null : new Date().toISOString() });
  }
}

export function attachSocketServer(httpServer, config) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    const origin = socket.handshake.headers.origin;
    if (origin !== config.clientOrigin) return next(new Error('ORIGIN_NOT_ALLOWED'));
    const token = readCookie(socket.handshake.headers.cookie, accessCookieName);
    if (!token) return next(new Error('UNAUTHENTICATED'));
    try {
      const payload = jwt.verify(token, config.accessTokenSecret, { algorithms: ['HS256'], issuer: 'wolflink-api', audience: 'wolflink-client' });
      if (payload.type !== 'access' || typeof payload.sub !== 'string') return next(new Error('UNAUTHENTICATED'));
      const user = await User.findById(payload.sub).select('_id emailVerified');
      if (!user) return next(new Error('UNAUTHENTICATED'));
      if (!user.emailVerified) return next(new Error('EMAIL_NOT_VERIFIED'));
      socket.data.userId = user._id.toString();
      return next();
    } catch {
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const becameOnline = trackOnline(userId, socket.id);
    socket.join(`user:${userId}`);
    if (becameOnline) publishPresence(io, userId, true).catch(() => {});

    socket.on('conversation:join', async (payload, acknowledge = () => {}) => {
      if (typeof acknowledge !== 'function') return;
      if (!allowSocketEvent(socket, 'conversation:join', 30)) return acknowledge({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' } });
      try {
        const conversation = await conversationService.getConversation(userId, payload?.conversationId);
        const room = messageService.conversationRoom(conversation.id);
        await socket.join(room);
        const peer = conversation.participants.find((person) => person.id !== userId);
        acknowledge({ ok: true, presence: peer ? { userId: peer.id, isOnline: (onlineSockets.get(peer.id)?.size || 0) > 0, lastSeen: peer.lastSeen || null } : null });
      } catch (error) {
        acknowledge({ ok: false, error: safeError(error) });
      }
    });

    socket.on('conversation:leave', (payload) => {
      if (typeof payload?.conversationId === 'string') socket.leave(messageService.conversationRoom(payload.conversationId));
    });

    socket.on('message:send', async (payload, acknowledge = () => {}) => {
      if (typeof acknowledge !== 'function') return;
      if (!allowSocketEvent(socket, 'message:send', 30)) return acknowledge({ ok: false, error: { code: 'RATE_LIMITED', message: 'You are sending messages too quickly. Please wait a moment.' } });
      try {
        const { error } = socketMessageSchema.validate(payload, { abortEarly: true, stripUnknown: true });
        if (error) return acknowledge({ ok: false, error: { code: 'INVALID_MESSAGE', message: 'Enter a valid message and try again.' } });
        const message = await messageService.sendTextMessage(userId, payload.conversationId, payload);
        io.to(messageService.conversationRoom(payload.conversationId)).emit('message:new', message);
        const conversation = await conversationService.getConversation(userId, payload.conversationId);
        const peerId = conversation.participants.find((person) => person.id !== userId)?.id;
        if (peerId) io.to(`user:${peerId}`).emit('message:notification', message);
        acknowledge({ ok: true, message });
      } catch (error) {
        acknowledge({ ok: false, error: safeError(error) });
      }
    });

    socket.on('typing:update', async (payload) => {
      if (typeof payload?.conversationId !== 'string' || typeof payload?.isTyping !== 'boolean') return;
      if (!allowSocketEvent(socket, 'typing:update', 120)) return;
      try {
        await conversationService.assertConversationMessageAllowed(userId, payload.conversationId);
        socket.to(messageService.conversationRoom(payload.conversationId)).emit('typing:update', { conversationId: payload.conversationId, userId, isTyping: payload.isTyping });
      } catch { /* Invalid or unauthorized events are ignored. */ }
    });

    socket.on('conversation:read', async (payload, acknowledge = () => {}) => {
      if (typeof acknowledge !== 'function') return;
      if (!allowSocketEvent(socket, 'conversation:read', 60)) return acknowledge({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' } });
      try {
        const { error } = socketReadSchema.validate(payload);
        if (error) return acknowledge({ ok: false, error: { code: 'INVALID_READ_MARKER', message: 'Refresh the conversation and try again.' } });
        const result = await messageService.markConversationRead(userId, payload?.conversationId, payload?.lastReadMessageId);
        io.to(messageService.conversationRoom(payload.conversationId)).emit('message:read', { conversationId: payload.conversationId, userId, ...result });
        acknowledge({ ok: true, ...result });
      } catch (error) {
        acknowledge({ ok: false, error: safeError(error) });
      }
    });

    socket.on('disconnect', () => {
      if (trackOffline(userId, socket.id)) {
        User.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } }).catch(() => {});
        publishPresence(io, userId, false).catch(() => {});
      }
    });
  });

  return io;
}
