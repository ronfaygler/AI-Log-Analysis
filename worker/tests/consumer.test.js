jest.mock('../src/db/redis', () => ({
  popJob: jest.fn(),
}));

jest.mock('../src/worker/processJob', () => ({
  processJob: jest.fn().mockResolvedValue(undefined),
}));

const { popJob } = require('../src/db/redis');
const { processJob } = require('../src/worker/processJob');
const { consumeOnce } = require('../src/worker/consumer');

const testConfig = {
  redisQueueName: 'logsentinel:test:jobs',
};

describe('consumeOnce', () => {
  beforeEach(() => {
    popJob.mockReset();
    processJob.mockClear();
  });

  it('pops a job and delegates to processJob', async () => {
    const job = { type: 'analyze_log', logEntryId: '507f1f77bcf86cd799439011' };
    popJob.mockResolvedValue(job);

    await consumeOnce(testConfig);

    expect(popJob).toHaveBeenCalledWith(testConfig.redisQueueName, 0);
    expect(processJob).toHaveBeenCalledWith(job, testConfig);
  });

  it('does nothing when queue returns no job', async () => {
    popJob.mockResolvedValue(null);

    await consumeOnce(testConfig);

    expect(processJob).not.toHaveBeenCalled();
  });
});
