jest.mock('../src/db/redis', () => ({
  popJob: jest.fn(),
}));

jest.mock('../src/worker/batchBuffer', () => ({
  add: jest.fn(),
  maybeFlush: jest.fn().mockResolvedValue(undefined),
  shouldFlush: jest.fn().mockReturnValue(false),
  flush: jest.fn().mockResolvedValue(undefined),
}));

const { popJob } = require('../src/db/redis');
const batchBuffer = require('../src/worker/batchBuffer');
const { consumeOnce } = require('../src/worker/consumer');

const testConfig = {
  redisQueueName: 'logsentinel:test:jobs',
  batchMaxLogs: 25,
  batchWindowMs: 10000,
};

describe('consumeOnce', () => {
  beforeEach(() => {
    popJob.mockReset();
    batchBuffer.add.mockClear();
    batchBuffer.maybeFlush.mockClear();
    batchBuffer.shouldFlush.mockClear();
    batchBuffer.flush.mockClear();
    batchBuffer.shouldFlush.mockReturnValue(false);
  });

  it('adds job to buffer and calls maybeFlush', async () => {
    const job = { type: 'analyze_log', logEntryId: '507f1f77bcf86cd799439011' };
    popJob.mockResolvedValue(job);

    await consumeOnce(testConfig);

    expect(popJob).toHaveBeenCalledWith(testConfig.redisQueueName, 1);
    expect(batchBuffer.add).toHaveBeenCalledWith(job);
    expect(batchBuffer.maybeFlush).toHaveBeenCalledWith(testConfig);
  });

  it('flushes immediately when shouldFlush is true', async () => {
    const job = { type: 'analyze_log', logEntryId: 'abc' };
    popJob.mockResolvedValue(job);
    batchBuffer.shouldFlush.mockReturnValue(true);

    await consumeOnce(testConfig);

    expect(batchBuffer.flush).toHaveBeenCalledWith(testConfig);
    expect(batchBuffer.maybeFlush).not.toHaveBeenCalled();
  });

  it('maybeFlush on empty queue timeout', async () => {
    popJob.mockResolvedValue(null);

    await consumeOnce(testConfig);

    expect(batchBuffer.add).not.toHaveBeenCalled();
    expect(batchBuffer.maybeFlush).toHaveBeenCalledWith(testConfig);
  });
});
