import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientMessageId: { type: String, required: true, maxlength: 64 },
  type: { type: String, enum: ['text', 'image', 'deleted'], default: 'text' },
  text: { type: String, trim: true, maxlength: 4000, default: '' },
  attachment: {
    url: { type: String, maxlength: 2048 },
    publicId: { type: String, maxlength: 255 },
    width: Number,
    height: Number,
    bytes: Number,
    format: String,
  },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ conversationId: 1, senderId: 1, clientMessageId: 1 }, { unique: true });

export const Message = mongoose.model('Message', messageSchema);
