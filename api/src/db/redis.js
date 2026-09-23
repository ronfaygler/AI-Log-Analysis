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

function jobsNotifyChannel(queueName) {
  return `${queueName}:notify`;
}

// LPUSH keeps the job durable in the list (survives a worker crash/restart);
// the PUBLISH is just a cheap wake-up signal so the worker can stay
// event-driven (subscribed, no polling) instead of repeatedly hitting Redis
// to check for work. The worker drains the list on startup too, in case a
// notify was missed while it was down.
async function publishJob(queueName, payload) {
  const redis = getRedis();
  await redis.lpush(queueName, JSON.stringify(payload));
  await redis.publish(jobsNotifyChannel(queueName), '1');
}

async function getCacheJson(key) {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setCacheJson(key, value, ttlSeconds) {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
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

async function invalidateUserLogCaches(userId) {
  const redis = getRedis();
  const pattern = `logs:list:${userId}:*`;
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

async function deleteCacheKey(key) {
  const redis = getRedis();
  await redis.del(key);
}

async function tryAcquireLock(key, ttlSeconds) {
  const redis = getRedis();
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

async function getValue(key) {
  const redis = getRedis();
  return redis.get(key);
}

async function setValue(key, value) {
  const redis = getRedis();
  await redis.set(key, value);
}

module.exports = {
  connectRedis,
  getRedis,
  publishJob,
  jobsNotifyChannel,
  getCacheJson,
  setCacheJson,
  logEventsChannel,
  publishLogEvent,
  invalidateUserLogCaches,
  deleteCacheKey,
  tryAcquireLock,
  getValue,
  setValue,
};
