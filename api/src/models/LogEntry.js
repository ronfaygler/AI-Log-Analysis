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
  },
  { timestamps: true }
);

module.exports = mongoose.model('LogEntry', logEntrySchema);
