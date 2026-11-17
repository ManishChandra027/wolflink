import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { io as connectSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { User } from '../src/models/User.js';
import { AbuseReport } from '../src/models/AbuseReport.js';
import { createTokenPair } from '../src/services/tokenService.js';
import * as conversationService from '../src/services/conversationService.js';
import * as messageService from '../src/services/messageService.js';
import { searchUsers, updateOwnProfile } from '../src/services/authService.js';

const mongoUrl = new URL(process.env.MONGODB_URI);
mongoUrl.pathname = `${mongoUrl.pathname.replace(/\/$/, '') || '/wolflink'}_messaging_${randomUUID().replaceAll('-', '')}`;
const config = loadConfig({ ...process.env, NODE_ENV: 'test', MONGODB_URI: mongoUrl.toString() });
let httpServer;
let ioServer;
let firstUser;
let secondUser;
let outsider;
let conversation;

function connect(user) {
  const { accessToken } = createTokenPair(user._id.toString(), config);
  return connectSocket(`http://127.0.0.1:${httpServer.address().port}`, {
    autoConnect: false,
    transports: ['websocket'],
    extraHeaders: { Origin: config.clientOrigin, Cookie: `wl_access=${accessToken}` },
  });
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(3000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result));
  });
}

before(async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  [firstUser, secondUser, outsider] = await User.create([
    { name: 'Avery Wolf', username: 'avery_wolf_test', email: `avery-${randomUUID()}@example.test`, passwordHash: 'test-hash', emailVerified: true },
    { name: 'Riley Link', username: 'riley_link_test', email: `riley-${randomUUID()}@example.test`, passwordHash: 'test-hash', emailVerified: true, phone: '+14155550123' },
    { name: 'Casey Solo', username: 'casey_solo_test', email: `casey-${randomUUID()}@example.test`, passwordHash: 'test-hash', emailVerified: true },
  ]);
  const app = createApp(config);
  httpServer = createServer(app);
  ioServer = (await import('../src/sockets/socketServer.js')).attachSocketServer(httpServer, config);
  app.set('io', ioServer);
  await new Promise((resolve, reject) => {
    httpServer.listen(0, '127.0.0.1', resolve);
    httpServer.once('error', reject);
  });
});

after(async () => {
  if (ioServer) await new Promise((resolve) => ioServer.close(resolve));
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('private discovery, conversation membership, message persistence, receipts, and socket authorization', async () => {
  const privatePhoneSearch = await searchUsers({ phone: '+1 (415) 555-0123' });
  assert.deepEqual(privatePhoneSearch, []);
  await updateOwnProfile(secondUser._id.toString(), { isPhonePublic: true });
  const publicPhoneSearch = await searchUsers({ phone: '+1 (415) 555-0123' });
  assert.equal(publicPhoneSearch.length, 1);
  assert.equal(publicPhoneSearch[0].phone, '+14155550123');
  const usernameSearch = await searchUsers({ query: 'riley_link_test' });
  assert.equal(Object.hasOwn(usernameSearch[0], 'phone'), false);

  conversation = await conversationService.createOrGetConversation(firstUser._id.toString(), secondUser._id.toString());
  const duplicate = await conversationService.createOrGetConversation(secondUser._id.toString(), firstUser._id.toString());
  assert.equal(duplicate.id, conversation.id);
  assert.equal(await Conversation.countDocuments(), 1);
  await assert.rejects(conversationService.getConversation(outsider._id.toString(), conversation.id), { code: 'NOT_A_CONVERSATION_MEMBER' });

  const clientMessageId = randomUUID();
  const payload = { text: 'A persisted test message', clientMessageId };
  const saved = await messageService.sendTextMessage(firstUser._id.toString(), conversation.id, payload);
  const retried = await messageService.sendTextMessage(firstUser._id.toString(), conversation.id, payload);
  assert.equal(retried.id, saved.id);
  assert.equal(await Message.countDocuments({ conversationId: conversation.id }), 1);
  assert.equal((await messageService.listMessages(secondUser._id.toString(), conversation.id)).messages[0].text, payload.text);
  assert.equal((await conversationService.listConversations(secondUser._id.toString()))[0].unreadCount, 1);
  await messageService.markConversationRead(secondUser._id.toString(), conversation.id, saved.id);
  assert.equal((await conversationService.listConversations(secondUser._id.toString()))[0].unreadCount, 0);
  await assert.rejects(messageService.deleteOwnMessage(secondUser._id.toString(), conversation.id, saved.id), { code: 'CANNOT_DELETE_MESSAGE' });
  const ownMessage = await messageService.sendTextMessage(firstUser._id.toString(), conversation.id, { text: 'Delete this later', clientMessageId: randomUUID() });
  assert.equal((await messageService.deleteOwnMessage(firstUser._id.toString(), conversation.id, ownMessage.id)).type, 'deleted');

  const sender = connect(firstUser);
  const recipient = connect(secondUser);
  const stranger = connect(outsider);
  const pendingSuffix = randomUUID();
  const unverified = await User.create({ name: 'Pending Wolf', username: `pending_${pendingSuffix.slice(0, 8)}`, email: `pending-${pendingSuffix}@example.test`, passwordHash: 'test-hash', emailVerified: false });
  const pendingSocket = connect(unverified);
  try {
    await Promise.all([waitForConnect(sender), waitForConnect(recipient), waitForConnect(stranger)]);
    const [senderJoin, recipientJoin] = await Promise.all([
      emitAck(sender, 'conversation:join', { conversationId: conversation.id }),
      emitAck(recipient, 'conversation:join', { conversationId: conversation.id }),
    ]);
    assert.equal(senderJoin.ok, true);
    assert.equal(recipientJoin.ok, true);
    const delivered = new Promise((resolve) => sender.once('message:new', resolve));
    const socketMessageId = randomUUID();
    const acknowledgement = await emitAck(sender, 'message:send', { conversationId: conversation.id, text: 'Live, persisted message', clientMessageId: socketMessageId });
    assert.equal(acknowledgement.ok, true);
    assert.equal((await delivered).id, acknowledgement.message.id);
    assert.ok(await Message.exists({ _id: acknowledgement.message.id }));
    const forbiddenJoin = await emitAck(stranger, 'conversation:join', { conversationId: conversation.id });
    assert.equal(forbiddenJoin.ok, false);
    await assert.rejects(waitForConnect(pendingSocket), /EMAIL_NOT_VERIFIED/);
  } finally {
    sender.disconnect();
    recipient.disconnect();
    stranger.disconnect();
    pendingSocket.disconnect();
  }

  const accessToken = createTokenPair(firstUser._id.toString(), config).accessToken;
  const reportResponse = await fetch(`http://127.0.0.1:${httpServer.address().port}/api/users/${secondUser._id}/report`, {
    method: 'POST',
    headers: { Origin: config.clientOrigin, Cookie: `wl_access=${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'spam', details: 'Test report' }),
  });
  assert.equal(reportResponse.status, 201);
  assert.equal(await AbuseReport.countDocuments({ reporterId: firstUser._id, reportedUserId: secondUser._id, status: 'open' }), 1);

  const blockResponse = await fetch(`http://127.0.0.1:${httpServer.address().port}/api/users/${secondUser._id}/block`, {
    method: 'POST', headers: { Origin: config.clientOrigin, Cookie: `wl_access=${accessToken}` },
  });
  assert.equal(blockResponse.status, 200);
  await assert.rejects(conversationService.createOrGetConversation(secondUser._id.toString(), firstUser._id.toString()), { code: 'USER_BLOCKED' });
  await assert.rejects(messageService.sendTextMessage(secondUser._id.toString(), conversation.id, { text: 'Blocked', clientMessageId: randomUUID() }), { code: 'USER_BLOCKED' });
});
