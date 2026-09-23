const { popJob, jobsNotifyChannel, createJobsSubscriber } = require('../db/redis');
const batchBuffer = require('./batchBuffer');

const BATCH_CHECK_INTERVAL_MS = 1000;

let draining = false;
let redrainRequested = false;

// Drains the job list with non-blocking RPOPs. Guarded against overlapping
// calls (e.g. a notify arriving mid-drain) with a redrain flag rather than
// letting two drains race against the same in-memory batch buffer.
async function drainQueue(config) {
  if (draining) {
    redrainRequested = true;
    return;
  }
  draining = true;
  try {
    do {
      redrainRequested = false;
      let job;
      while ((job = await popJob(config.redisQueueName)) !== null) {
        batchBuffer.add(job);
        if (batchBuffer.shouldFlush(config)) {
          await batchBuffer.flush(config);
        }
      }
    } while (redrainRequested);
  } finally {
    draining = false;
  }
}

async function startConsumer(config) {
  console.log(`Consuming queue: ${config.redisQueueName} (event-driven, batch max ${config.batchMaxLogs}, window ${config.batchWindowMs}ms)`);

  // Catch up on anything queued while the worker was down or restarting.
  await drainQueue(config).catch((err) => console.error('Initial drain error:', err));

  const channel = jobsNotifyChannel(config.redisQueueName);
  const subscriber = createJobsSubscriber(config.redisUrl);

  subscriber.on('error', (err) => console.error('Jobs subscriber error:', err.message));
  subscriber.on('message', () => {
    drainQueue(config).catch((err) => console.error('Drain error:', err));
  });

  await subscriber.subscribe(channel);

  // The batch window (BATCH_WINDOW_MS) is a time-based flush independent of
  // when jobs arrive, so it still needs a periodic check - this is a local,
  // in-memory check only and touches Redis solely if there's something to flush.
  setInterval(() => {
    batchBuffer.maybeFlush(config).catch((err) => console.error('Flush error:', err));
  }, BATCH_CHECK_INTERVAL_MS);
}

module.exports = { startConsumer, drainQueue };
