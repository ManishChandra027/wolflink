import mongoose from 'mongoose';
import { HttpError } from '../errors/HttpError.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { assertEmailVerified } from './authService.js';

const safeParticipantFields = 'name username avatar bio emailVerified lastSeen';

function toConversation(conversation, currentUserId) {
  const readState = (conversation.readStates || []).find((state) => state.userId.toString() === currentUserId.toString());
  const peerReadState = (conversation.readStates || []).find((state) => state.userId.toString() !== currentUserId.toString());
  const userSetting = (conversation.userSettings || []).find((setting) => setting.userId.toString() === currentUserId.toString());
  const currentPerson = (conversation.participants || []).find((person) => person._id.toString() === currentUserId.toString());
  const peer = (conversation.participants || []).find((person) => person._id.toString() !== currentUserId.toString());
  const blockedByMe = Boolean(peer && currentPerson?.blockedUserIds?.some((id) => id.toString() === peer._id.toString()));
  const blockedByPeer = Boolean(peer?.blockedUserIds?.some((id) => id.toString() === currentUserId.toString()));
  return {
    id: conversation._id.toString(),
    participants: (conversation.participants || []).map((user) => ({
      id: user._id.toString(),
      name: user.name,
      username: user.username || '',
      avatar: user.avatar,
      bio: user.bio,
      emailVerified: user.emailVerified,
      lastSeen: user.lastSeen,
    })),
    lastActivityAt: conversation.lastActivityAt,
    createdAt: conversation.createdAt,
    lastReadMessageId: readState?.lastReadMessageId?.toString() || null,
    peerLastReadMessageId: peerReadState?.lastReadMessageId?.toString() || null,
    blockedByMe,
    blockedByPeer,
    messagingBlocked: blockedByMe || blockedByPeer,
    isMuted: userSetting?.isMuted === true,
    isPinned: userSetting?.isPinned === true,
  };
}

function makePairKey(firstId, secondId) {
  return [firstId.toString(), secondId.toString()].sort().join(':');
}

async function populateParticipants(query) {
  return query.populate({ path: 'participants', select: `${safeParticipantFields} blockedUserIds` }).lean();
}

export async function createOrGetConversation(currentUserId, otherUserId) {
  await assertEmailVerified(currentUserId);
  if (!mongoose.isValidObjectId(otherUserId)) throw new HttpError(400, 'INVALID_USER_ID', 'Choose a valid person to start a conversation.');
  if (currentUserId === otherUserId) throw new HttpError(400, 'SELF_CONVERSATION', 'You cannot start a conversation with yourself.');

  const otherUser = await User.findOne({ _id: otherUserId, emailVerified: true }).select('_id');
  if (!otherUser) {
    const exists = await User.exists({ _id: otherUserId });
    if (exists) throw new HttpError(403, 'RECIPIENT_NOT_VERIFIED', 'This person is not available for conversations yet.');
    throw new HttpError(404, 'USER_NOT_FOUND', 'This person could not be found.');
  }
  if (await User.exists({ $or: [
    { _id: currentUserId, blockedUserIds: otherUserId },
    { _id: otherUserId, blockedUserIds: currentUserId },
  ] })) throw new HttpError(403, 'USER_BLOCKED', 'This conversation is unavailable because one of you has blocked the other.');

  const pairKey = makePairKey(currentUserId, otherUserId);
  let conversation = await Conversation.findOne({ pairKey }).select('+pairKey');
  if (!conversation) {
    try {
      conversation = await Conversation.create({ participants: [currentUserId, otherUserId], pairKey });
    } catch (error) {
      if (error.code !== 11000) throw error;
      conversation = await Conversation.findOne({ pairKey }).select('+pairKey');
    }
  }
  return toConversation(await populateParticipants(Conversation.findById(conversation._id)), currentUserId);
}

export async function listConversations(currentUserId) {
  await assertEmailVerified(currentUserId);
  const conversations = await populateParticipants(
    Conversation.find({ participants: currentUserId }).sort({ lastActivityAt: -1, _id: -1 }).limit(100),
  );
  if (!conversations.length) return [];
  const currentId = new mongoose.Types.ObjectId(currentUserId);
  const readMessageIds = conversations.flatMap((conversation) => conversation.readStates || [])
    .filter((state) => state.userId.toString() === currentUserId && state.lastReadMessageId)
    .map((state) => state.lastReadMessageId);
  const anchors = readMessageIds.length
    ? await Message.find({ _id: { $in: readMessageIds } }).select('createdAt').lean()
    : [];
  const anchorById = new Map(anchors.map((message) => [message._id.toString(), message]));
  const unreadClauses = conversations.map((conversation) => {
    const state = (conversation.readStates || []).find((item) => item.userId.toString() === currentUserId);
    const clause = { conversationId: conversation._id, senderId: { $ne: currentId } };
    const anchor = state?.lastReadMessageId && anchorById.get(state.lastReadMessageId.toString());
    if (anchor) {
      clause.$or = [
        { createdAt: { $gt: anchor.createdAt } },
        { createdAt: anchor.createdAt, _id: { $gt: state.lastReadMessageId } },
      ];
    } else if (state?.lastReadAt) {
      clause.createdAt = { $gt: state.lastReadAt };
    }
    return clause;
  });
  const conversationIds = conversations.map((conversation) => conversation._id);
  const [latestMessages, unreadCounts] = await Promise.all([
    Message.aggregate([
      { $match: { conversationId: { $in: conversationIds } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: '$conversationId', senderId: { $first: '$senderId' }, type: { $first: '$type' }, text: { $first: '$text' }, createdAt: { $first: '$createdAt' } } },
    ]),
    Message.aggregate([
      { $match: { $or: unreadClauses } },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
    ]),
  ]);
  const latestByConversation = new Map(latestMessages.map((message) => [message._id.toString(), message]));
  const unreadByConversation = new Map(unreadCounts.map((entry) => [entry._id.toString(), entry.count]));
  return conversations.map((conversation) => {
    const id = conversation._id.toString();
    const lastMessage = latestByConversation.get(id);
    return {
      ...toConversation(conversation, currentUserId),
      lastMessage: lastMessage ? { senderId: lastMessage.senderId.toString(), type: lastMessage.type, text: lastMessage.type === 'deleted' ? 'Message deleted' : lastMessage.type === 'image' && !lastMessage.text ? 'Photo' : lastMessage.text.slice(0, 140), createdAt: lastMessage.createdAt } : null,
      unreadCount: unreadByConversation.get(id) || 0,
    };
  }).sort((first, second) => Number(second.isPinned) - Number(first.isPinned)
    || Number(second.unreadCount > 0) - Number(first.unreadCount > 0)
    || new Date(second.lastActivityAt) - new Date(first.lastActivityAt));
}

export async function getConversation(currentUserId, conversationId) {
  await assertEmailVerified(currentUserId);
  if (!mongoose.isValidObjectId(conversationId)) throw new HttpError(400, 'INVALID_CONVERSATION_ID', 'Choose a valid conversation.');
  const conversation = await populateParticipants(Conversation.findOne({ _id: conversationId, participants: currentUserId }));
  if (!conversation) {
    const exists = await Conversation.exists({ _id: conversationId });
    if (exists) throw new HttpError(403, 'NOT_A_CONVERSATION_MEMBER', 'You do not have access to this conversation.');
    throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'This conversation could not be found.');
  }
  if (conversation.participants.length !== 2 || conversation.participants.some((user) => !user?.emailVerified)) {
    throw new HttpError(403, 'RECIPIENT_NOT_VERIFIED', 'This conversation is not available yet.');
  }
  return toConversation(conversation, currentUserId);
}

export async function assertConversationMessageAllowed(currentUserId, conversationId) {
  const conversation = await getConversation(currentUserId, conversationId);
  const peerId = conversation.participants.find((person) => person.id !== currentUserId)?.id;
  if (!peerId) throw new HttpError(403, 'NOT_A_CONVERSATION_MEMBER', 'You do not have access to this conversation.');
  if (await User.exists({ $or: [
    { _id: currentUserId, blockedUserIds: peerId },
    { _id: peerId, blockedUserIds: currentUserId },
  ] })) throw new HttpError(403, 'USER_BLOCKED', 'Messages are unavailable because one of you has blocked the other.');
  return conversation;
}

export async function updateConversationPreferences(currentUserId, conversationId, changes) {
  const conversation = await Conversation.findOne({ _id: conversationId, participants: currentUserId });
  if (!conversation) return getConversation(currentUserId, conversationId);
  let settings = conversation.userSettings.find((entry) => entry.userId.toString() === currentUserId.toString());
  if (!settings) {
    conversation.userSettings.push({ userId: currentUserId });
    settings = conversation.userSettings.at(-1);
  }
  if (typeof changes.isMuted === 'boolean') settings.isMuted = changes.isMuted;
  if (typeof changes.isPinned === 'boolean') settings.isPinned = changes.isPinned;
  await conversation.save();
  return toConversation(await populateParticipants(Conversation.findById(conversation._id)), currentUserId);
}
