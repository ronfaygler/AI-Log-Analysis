jest.mock('../src/db/redis', () => ({
  popJob: jest.fn(),
  jobsNotifyChannel: jest.fn((queueName) => `${queueName}:notify`),
  createJobsSubscriber: jest.fn(),
}));

jest.mock('../src/worker/batchBuffer', () => ({
  add: jest.fn(),
  maybeFlush: jest.fn().mockResolvedValue(undefined),
  shouldFlush: jest.fn().mockReturnValue(false),
  flush: jest.fn().mockResolvedValue(undefined),
}));

const { popJob } = require('../src/db/redis');
const batchBuffer = require('../src/worker/batchBuffer');
const { drainQueue } = require('../src/worker/consumer');

const testConfig = {
  redisQueueName: 'logsentinel:test:jobs',
  batchMaxLogs: 25,
  batchWindowMs: 10000,
};

describe('drainQueue', () => {
  beforeEach(() => {
    popJob.mockReset();
    batchBuffer.add.mockClear();
    batchBuffer.maybeFlush.mockClear();
    batchBuffer.shouldFlush.mockClear();
    batchBuffer.flush.mockClear();
    batchBuffer.shouldFlush.mockReturnValue(false);
  });

  it('does nothing when the queue is empty', async () => {
    popJob.mockResolvedValue(null);

    await drainQueue(testConfig);

    expect(popJob).toHaveBeenCalledWith(testConfig.redisQueueName);
    expect(batchBuffer.add).not.toHaveBeenCalled();
  });

  it('drains every job in the list until empty', async () => {
    const jobA = { type: 'analyze_log', logEntryId: 'a' };
    const jobB = { type: 'analyze_log', logEntryId: 'b' };
    popJob
      .mockResolvedValueOnce(jobA)
      .mockResolvedValueOnce(jobB)
      .mockResolvedValueOnce(null);

    await drainQueue(testConfig);

    expect(batchBuffer.add).toHaveBeenCalledWith(jobA);
    expect(batchBuffer.add).toHaveBeenCalledWith(jobB);
    expect(popJob).toHaveBeenCalledTimes(3);
  });

  it('flushes as soon as shouldFlush is true, mid-drain', async () => {
    const jobA = { type: 'analyze_log', logEntryId: 'a' };
    popJob.mockResolvedValueOnce(jobA).mockResolvedValueOnce(null);
    batchBuffer.shouldFlush.mockReturnValue(true);

    await drainQueue(testConfig);

    expect(batchBuffer.flush).toHaveBeenCalledWith(testConfig);
  });

  it('re-drains if a notify arrives while already draining', async () => {
    const jobA = { type: 'analyze_log', logEntryId: 'a' };
    let callCount = 0;
    popJob.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        // Simulate a notify firing mid-drain, requesting a redrain.
        drainQueue(testConfig);
        return jobA;
      }
      return null;
    });

    await drainQueue(testConfig);

    expect(batchBuffer.add).toHaveBeenCalledWith(jobA);
  });
});
