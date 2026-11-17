import mongoose from 'mongoose';

const abuseReportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, enum: ['spam', 'harassment', 'impersonation', 'inappropriate', 'other'], required: true },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['open', 'reviewed', 'actioned'], default: 'open', index: true },
}, { timestamps: true });

abuseReportSchema.index({ reporterId: 1, reportedUserId: 1, createdAt: -1 });

export const AbuseReport = mongoose.model('AbuseReport', abuseReportSchema);
