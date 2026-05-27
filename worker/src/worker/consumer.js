const { popJob } = require('../db/redis');
const batchBuffer = require('./batchBuffer');

const BRPOP_TIMEOUT_SEC = 1;

async function consumeOnce(config) {
  const job = await popJob(config.redisQueueName, BRPOP_TIMEOUT_SEC);
  if (job) {
    batchBuffer.add(job);
    if (batchBuffer.shouldFlush(config)) {
      await batchBuffer.flush(config);
      return;
    }
  }
  await batchBuffer.maybeFlush(config);
}

async function startConsumer(config) {
  console.log(
    `Consuming queue: ${config.redisQueueName} (batch max ${config.batchMaxLogs}, window ${config.batchWindowMs}ms)`
  );

  while (true) {
    try {
      await consumeOnce(config);
    } catch (err) {
      console.error('Consumer error:', err);
      await sleep(2000);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { startConsumer, consumeOnce };
