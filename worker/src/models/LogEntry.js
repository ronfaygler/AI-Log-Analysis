const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema(
  {
    summary: { type: String, required: true },
    severity: { type: String, required: true },
    recommendation: { type: String, required: true },
    analyzedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const logEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', required: true },
    level: { type: String, required: true },
    message: { type: String, required: true },
    source: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    loggedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'done', 'failed'],
      default: 'queued',
    },
    analysis: { type: analysisSchema },
    errorMessage: { type: String },
  },
  { timestamps: true, collection: 'logentries' }
);

module.exports = mongoose.model('LogEntry', logEntrySchema);
