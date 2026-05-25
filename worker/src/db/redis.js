const Redis = require('ioredis');

let client;

function getRedis() {
  if (!client) {
    throw new Error('Redis not initialized');
  }
  return client;
}

async function connectRedis(url) {
  client = new Redis(url, { maxRetriesPerRequest: null });
  await client.ping();
  console.log('Redis connected');
  return client;
}

/**
 * Blocking pop from the job queue (FIFO with API LPUSH).
 * @returns {Promise<object|null>} Parsed job payload or null on timeout
 */
async function popJob(queueName, timeoutSeconds = 0) {
  const redis = getRedis();
  const result = await redis.brpop(queueName, timeoutSeconds);
  if (!result) {
    return null;
  }
  const [, payload] = result;
  return JSON.parse(payload);
}

module.exports = { connectRedis, getRedis, popJob };
