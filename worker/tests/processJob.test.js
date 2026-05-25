jest.mock('../src/services/claude', () => ({
  analyzeLog: jest.fn(),
}));

jest.mock('../src/services/notification', () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

const { analyzeLog } = require('../src/services/claude');
const { sendNotification } = require('../src/services/notification');
const LogEntry = require('../src/models/LogEntry');
const { processJob } = require('../src/worker/processJob');
const mongoose = require('mongoose');

const testConfig = {
  anthropicApiKey: 'test-key',
  anthropicModel: 'claude-3-5-haiku-latest',
  notifyWebhookUrl: '',
};

describe('processJob', () => {
  beforeEach(() => {
    analyzeLog.mockReset();
    sendNotification.mockClear();
  });

  it('analyzes log and marks entry done (no real Claude API)', async () => {
    analyzeLog.mockResolvedValue({
      summary: 'Database connection failed',
      severity: 'high',
      recommendation: 'Check connection pool settings',
      analyzedAt: new Date(),
    });

    const entry = await LogEntry.create({
      userId: new mongoose.Types.ObjectId(),
      apiKeyId: new mongoose.Types.ObjectId(),
      level: 'error',
      message: 'Connection timeout',
      loggedAt: new Date(),
      status: 'queued',
    });

    const job = {
      type: 'analyze_log',
      logEntryId: entry._id.toString(),
      userId: entry.userId.toString(),
      level: 'error',
      message: 'Connection timeout',
      loggedAt: entry.loggedAt.toISOString(),
    };

    await processJob(job, testConfig);

    expect(analyzeLog).toHaveBeenCalledTimes(1);
    const updated = await LogEntry.findById(entry._id);
    expect(updated.status).toBe('done');
    expect(updated.analysis.summary).toContain('Database');
    expect(sendNotification).toHaveBeenCalledWith(
      testConfig,
      expect.objectContaining({ event: 'log.analyzed' })
    );
  });

  it('marks entry failed when Claude throws', async () => {
    analyzeLog.mockRejectedValue(new Error('API rate limit'));

    const entry = await LogEntry.create({
      userId: new mongoose.Types.ObjectId(),
      apiKeyId: new mongoose.Types.ObjectId(),
      level: 'error',
      message: 'boom',
      loggedAt: new Date(),
      status: 'queued',
    });

    await processJob(
      {
        type: 'analyze_log',
        logEntryId: entry._id.toString(),
        level: 'error',
        message: 'boom',
        loggedAt: entry.loggedAt.toISOString(),
      },
      testConfig
    );

    const updated = await LogEntry.findById(entry._id);
    expect(updated.status).toBe('failed');
    expect(updated.errorMessage).toBe('API rate limit');
  });
});
