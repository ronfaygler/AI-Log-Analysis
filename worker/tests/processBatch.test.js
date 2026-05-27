jest.mock('../src/services/claude', () => ({
  analyzeLogBatch: jest.fn(),
}));

jest.mock('../src/services/notification', () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

const { analyzeLogBatch } = require('../src/services/claude');
const { sendNotification } = require('../src/services/notification');
const LogEntry = require('../src/models/LogEntry');
const { processBatch } = require('../src/worker/processBatch');
const mongoose = require('mongoose');

const testConfig = {
  anthropicApiKey: 'test-key',
  anthropicModel: 'claude-3-5-haiku-latest',
  notifyWebhookUrl: '',
  batchMaxLogs: 25,
  batchWindowMs: 10000,
};

describe('processBatch', () => {
  beforeEach(() => {
    analyzeLogBatch.mockReset();
    sendNotification.mockClear();
  });

  it('analyzes batch and marks entries done (one Claude call)', async () => {
    analyzeLogBatch.mockResolvedValue({
      incidentSummary: 'Multiple failed logins from one IP',
      overallSeverity: 'high',
      recommendation: 'Enable rate limiting on /login',
      logs: [
        { index: 0, summary: 'Failed login', severity: 'medium' },
        { index: 1, summary: 'Failed login', severity: 'medium' },
      ],
    });

    const userId = new mongoose.Types.ObjectId();
    const apiKeyId = new mongoose.Types.ObjectId();
    const entry1 = await LogEntry.create({
      userId,
      apiKeyId,
      level: 'error',
      message: 'Failed login a',
      loggedAt: new Date(),
      status: 'queued',
    });
    const entry2 = await LogEntry.create({
      userId,
      apiKeyId,
      level: 'error',
      message: 'Failed login b',
      loggedAt: new Date(),
      status: 'queued',
    });

    const jobs = [
      {
        type: 'analyze_log',
        logEntryId: entry1._id.toString(),
        level: 'error',
        message: 'Failed login a',
        loggedAt: entry1.loggedAt.toISOString(),
      },
      {
        type: 'analyze_log',
        logEntryId: entry2._id.toString(),
        level: 'error',
        message: 'Failed login b',
        loggedAt: entry2.loggedAt.toISOString(),
      },
    ];

    await processBatch(jobs, testConfig);

    expect(analyzeLogBatch).toHaveBeenCalledTimes(1);
    expect(analyzeLogBatch).toHaveBeenCalledWith(jobs, testConfig);

    const updated1 = await LogEntry.findById(entry1._id);
    const updated2 = await LogEntry.findById(entry2._id);
    expect(updated1.status).toBe('done');
    expect(updated2.status).toBe('done');
    expect(updated1.analysis.summary).toBe('Failed login');
    expect(updated1.analysis.severity).toBe('medium');
    expect(updated1.analysis.recommendation).toContain('rate limiting');
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it('marks all entries failed when Claude throws', async () => {
    analyzeLogBatch.mockRejectedValue(new Error('API rate limit'));

    const entry = await LogEntry.create({
      userId: new mongoose.Types.ObjectId(),
      apiKeyId: new mongoose.Types.ObjectId(),
      level: 'error',
      message: 'boom',
      loggedAt: new Date(),
      status: 'queued',
    });

    await processBatch(
      [
        {
          type: 'analyze_log',
          logEntryId: entry._id.toString(),
          level: 'error',
          message: 'boom',
          loggedAt: entry.loggedAt.toISOString(),
        },
      ],
      testConfig
    );

    const updated = await LogEntry.findById(entry._id);
    expect(updated.status).toBe('failed');
    expect(updated.errorMessage).toBe('API rate limit');
  });
});
