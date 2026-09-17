const request = require('supertest');
const { createApp } = require('../src/app');
const {
  tryAcquireLock,
  getValue,
  setValue,
  publishJob,
  publishLogEvent,
  invalidateUserLogCaches,
} = require('../src/db/redis');
const LogEntry = require('../src/models/LogEntry');
const User = require('../src/models/User');
const { testConfig } = require('./helpers');

// Zero-delay timing so tests don't spend real wall-clock time (or leave
// lingering background timers) waiting on the demo's cosmetic stagger.
const INSTANT_TIMING = {
  initialDelayMs: 0,
  perDocDelayMs: 0,
  processingDelayMs: () => 0,
  interChunkDelayMs: () => 0,
};

// For tests that only care about the immediate post-seed state ('queued', no
// analysis): a background simulation that never proceeds during the test run
// (avoids both racing the assertion and leaking a real timer past teardown).
const demoApp = createApp({
  ...testConfig,
  demoMode: true,
  demoSimTiming: { ...INSTANT_TIMING, initialDelayMs: 3600000 },
});
// Instant timing for the one test that needs to observe the full
// queued -> processing -> done progression without waiting on real delays.
const demoAppFast = createApp({ ...testConfig, demoMode: true, demoSimTiming: INSTANT_TIMING });
const offApp = createApp({ ...testConfig, demoMode: false });

async function waitFor(predicate, { timeoutMs = 5000, intervalMs = 25 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('waitFor: condition not met within timeout');
}

describe('demo mode', () => {
  beforeEach(() => {
    tryAcquireLock.mockReset();
    getValue.mockReset();
    setValue.mockReset();
    publishJob.mockReset();
    publishLogEvent.mockReset();
    invalidateUserLogCaches.mockReset();
    tryAcquireLock.mockResolvedValue(true);
    getValue.mockResolvedValue(null);
    setValue.mockResolvedValue(undefined);
    publishJob.mockResolvedValue(undefined);
    publishLogEvent.mockResolvedValue(undefined);
    invalidateUserLogCaches.mockResolvedValue(undefined);
  });

  it('404s when DEMO_MODE is off', async () => {
    await request(offApp).post('/demo/login').expect(404);
    await request(offApp).post('/demo/seed').expect(404);
  });

  it('logs in as the fixed demo user and sets a cookie', async () => {
    const res = await request(demoApp).post('/demo/login').expect(200);
    expect(res.body.user.email).toBe('demo@logsentinel.local');
    expect(res.headers['set-cookie']?.[0]).toMatch(/logsentinel_token=/);
  });

  it('seed appends logs as queued with no analysis, never touches the job queue', async () => {
    const res = await request(demoApp).post('/demo/seed').expect(202);
    expect(res.body.seeded).toBeGreaterThan(0);
    expect(publishJob).not.toHaveBeenCalled();

    const demoUser = await User.findOne({ email: 'demo@logsentinel.local' });
    const entries = await LogEntry.find({ userId: demoUser._id });
    expect(entries).toHaveLength(res.body.seeded);
    for (const entry of entries) {
      expect(entry.status).toBe('queued');
      expect(entry.analysis?.summary).toBeUndefined();
    }
  });

  it('seed is append-only across multiple calls', async () => {
    const first = await request(demoApp).post('/demo/seed').expect(202);
    const second = await request(demoApp).post('/demo/seed').expect(202);

    const demoUser = await User.findOne({ email: 'demo@logsentinel.local' });
    const count = await LogEntry.countDocuments({ userId: demoUser._id });
    expect(count).toBe(first.body.seeded + second.body.seeded);
  });

  it('returns 429 when the seed lock is already held', async () => {
    tryAcquireLock.mockResolvedValueOnce(false);
    const res = await request(demoApp).post('/demo/seed').expect(429);
    expect(res.body.error).toMatch(/try again/i);
  });

  it('clears demo logs on login if idle more than 10 minutes since last seed', async () => {
    await request(demoApp).post('/demo/seed').expect(202);
    const demoUser = await User.findOne({ email: 'demo@logsentinel.local' });
    await expect(LogEntry.countDocuments({ userId: demoUser._id })).resolves.toBeGreaterThan(0);

    getValue.mockResolvedValue(String(Date.now() - 11 * 60 * 1000));
    await request(demoApp).post('/demo/login').expect(200);

    await expect(LogEntry.countDocuments({ userId: demoUser._id })).resolves.toBe(0);
  });

  it('does not clear demo logs on login if seeded recently', async () => {
    await request(demoApp).post('/demo/seed').expect(202);
    const demoUser = await User.findOne({ email: 'demo@logsentinel.local' });

    getValue.mockResolvedValue(String(Date.now() - 60 * 1000));
    await request(demoApp).post('/demo/login').expect(200);

    await expect(LogEntry.countDocuments({ userId: demoUser._id })).resolves.toBeGreaterThan(0);
  });

  it('simulates queued -> processing -> done over time with no worker involvement', async () => {
    const res = await request(demoAppFast).post('/demo/seed').expect(202);
    const demoUser = await User.findOne({ email: 'demo@logsentinel.local' });

    await waitFor(async () => {
      const remaining = await LogEntry.countDocuments({
        userId: demoUser._id,
        status: { $ne: 'done' },
      });
      return remaining === 0;
    });

    const entries = await LogEntry.find({ userId: demoUser._id });
    expect(entries).toHaveLength(res.body.seeded);
    for (const entry of entries) {
      expect(entry.status).toBe('done');
      expect(entry.analysis?.summary).toBeTruthy();
      expect(entry.analysis?.severity).toBeTruthy();
    }
    expect(publishJob).not.toHaveBeenCalled();
    expect(publishLogEvent).toHaveBeenCalled();
  });
});
