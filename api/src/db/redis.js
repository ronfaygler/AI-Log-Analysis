const Redis = require('ioredis');

let client;

function getRedis() {
  if (!client) {
    throw new Error('Redis not initialized');
  }
  return client;
}

async function connectRedis(url) {
  client = new Redis(url, { maxRetriesPerRequest: 3 });
  await client.ping();
  console.log('Redis connected');
  return client;
}

async function publishJob(queueName, payload) {
  const redis = getRedis();
  await redis.lpush(queueName, JSON.stringify(payload));
}

module.exports = { connectRedis, getRedis, publishJob };
