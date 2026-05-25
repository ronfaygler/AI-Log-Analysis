const { popJob } = require('../db/redis');
const { processJob } = require('./processJob');

async function startConsumer(config) {
  console.log(`Consuming queue: ${config.redisQueueName}`);

  while (true) {
    try {
      const job = await popJob(config.redisQueueName, 0);
      if (job) {
        await processJob(job, config);
      }
    } catch (err) {
      console.error('Consumer error:', err);
      await sleep(2000);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { startConsumer };
