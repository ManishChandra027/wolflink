import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  participants: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    required: true,
    validate: {
      validator(value) { return value.length === 2 && value[0].toString() !== value[1].toString(); },
      message: 'A private conversation must have two different participants.',
    },
  },
  pairKey: { type: String, required: true, unique: true, select: false },
  lastActivityAt: { type: Date, default: Date.now, index: true },
  readStates: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, default: null },
    lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  }],
  userSettings: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isMuted: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
  }],
}, { timestamps: true });

conversationSchema.index({ participants: 1, lastActivityAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
