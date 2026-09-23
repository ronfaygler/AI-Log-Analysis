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
 * Non-blocking pop from the job queue (FIFO with API LPUSH -> worker RPOP).
 * Call in a loop to drain; returns null once the list is empty.
 * @returns {Promise<object|null>} Parsed job payload or null
 */
async function popJob(queueName) {
  const redis = getRedis();
  const payload = await redis.rpop(queueName);
  if (!payload) {
    return null;
  }
  return JSON.parse(payload);
}

function jobsNotifyChannel(queueName) {
  return `${queueName}:notify`;
}

// A dedicated connection for SUBSCRIBE, since a subscribed ioredis connection
// can't also issue regular commands (RPOP etc. still go through the main client).
function createJobsSubscriber(url) {
  return new Redis(url);
}

function logEventsChannel(userId) {
  return `logsentinel:events:${userId}`;
}

async function publishLogEvent(userId, logEntryId, event = 'log.updated') {
  const redis = getRedis();
  const channel = logEventsChannel(userId);
  await redis.publish(
    channel,
    JSON.stringify({ event, logEntryId: String(logEntryId) })
  );
}

module.exports = {
  connectRedis,
  getRedis,
  popJob,
  jobsNotifyChannel,
  createJobsSubscriber,
  publishLogEvent,
  logEventsChannel,
};
