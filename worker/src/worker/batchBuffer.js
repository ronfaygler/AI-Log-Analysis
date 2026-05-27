const { processBatch } = require('./processBatch');

let pending = [];
let firstAddedAt = null;

function resetBuffer() {
  pending = [];
  firstAddedAt = null;
}

function add(job) {
  if (job.type !== 'analyze_log' || !job.logEntryId) {
    console.warn('Skipping unknown job type:', job?.type);
    return;
  }
  pending.push(job);
  if (!firstAddedAt) {
    firstAddedAt = Date.now();
  }
}

function shouldFlush(config) {
  if (pending.length === 0) return false;
  if (pending.length >= config.batchMaxLogs) return true;
  return Date.now() - firstAddedAt >= config.batchWindowMs;
}

async function maybeFlush(config) {
  if (shouldFlush(config)) {
    await flush(config);
  }
}

async function flush(config) {
  if (pending.length === 0) return;
  const jobs = pending.slice();
  resetBuffer();
  await processBatch(jobs, config);
}

module.exports = { add, maybeFlush, flush, shouldFlush, resetBuffer, getPendingCount: () => pending.length };
