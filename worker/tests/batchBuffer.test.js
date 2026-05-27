jest.mock('../src/worker/processBatch', () => ({
  processBatch: jest.fn().mockResolvedValue(undefined),
}));

const { processBatch } = require('../src/worker/processBatch');
const batchBuffer = require('../src/worker/batchBuffer');

const testConfig = {
  batchMaxLogs: 3,
  batchWindowMs: 5000,
};

describe('batchBuffer', () => {
  beforeEach(() => {
    processBatch.mockClear();
    batchBuffer.resetBuffer();
  });

  it('flushes when batch max logs reached', async () => {
    const jobs = [
      { type: 'analyze_log', logEntryId: '1' },
      { type: 'analyze_log', logEntryId: '2' },
      { type: 'analyze_log', logEntryId: '3' },
    ];

    batchBuffer.add(jobs[0]);
    batchBuffer.add(jobs[1]);
    expect(batchBuffer.getPendingCount()).toBe(2);

    batchBuffer.add(jobs[2]);
    await batchBuffer.maybeFlush(testConfig);

    expect(processBatch).toHaveBeenCalledTimes(1);
    expect(processBatch).toHaveBeenCalledWith(jobs, testConfig);
    expect(batchBuffer.getPendingCount()).toBe(0);
  });

  it('flushes when window elapsed on maybeFlush', async () => {
    batchBuffer.add({ type: 'analyze_log', logEntryId: 'a' });

    const originalNow = Date.now;
    Date.now = () => originalNow() + testConfig.batchWindowMs + 1;

    await batchBuffer.maybeFlush(testConfig);

    Date.now = originalNow;

    expect(processBatch).toHaveBeenCalledTimes(1);
    expect(batchBuffer.getPendingCount()).toBe(0);
  });

  it('does not flush before window or max count', async () => {
    batchBuffer.add({ type: 'analyze_log', logEntryId: 'a' });
    await batchBuffer.maybeFlush(testConfig);
    expect(processBatch).not.toHaveBeenCalled();
    expect(batchBuffer.getPendingCount()).toBe(1);
  });
});
