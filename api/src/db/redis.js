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

module.exports = {
  connectRedis,
  getRedis,
  publishJob,
  getCacheJson,
  setCacheJson,
  logEventsChannel,
  publishLogEvent,
  invalidateUserLogCaches,
  deleteCacheKey,
};
