const mongoose = require('mongoose');

const logEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', required: true },
    level: { type: String, required: true, enum: ['debug', 'info', 'warn', 'error', 'fatal'] },
    message: { type: String, required: true },
    source: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    loggedAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['queued', 'processing', 'done', 'failed'], default: 'queued' },
    analysis: {
      summary: String,
      severity: String,
      recommendation: String,
      analyzedAt: Date,
    },
    errorMessage: String,
  },
  { timestamps: true }
);

logEntrySchema.index({ userId: 1, loggedAt: -1 });
logEntrySchema.index({ userId: 1, level: 1, loggedAt: -1 });
logEntrySchema.index({ userId: 1, status: 1, loggedAt: -1 });
logEntrySchema.index({ userId: 1, source: 1, loggedAt: -1 });
logEntrySchema.index({ userId: 1, 'analysis.severity': 1, loggedAt: -1 });

module.exports = mongoose.model('LogEntry', logEntrySchema);
