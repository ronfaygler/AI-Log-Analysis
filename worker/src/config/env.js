const required = ['MONGO_URI', 'REDIS_URL', 'ANTHROPIC_API_KEY'];

function loadEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGO_URI,
    redisUrl: process.env.REDIS_URL,
    redisQueueName: process.env.REDIS_QUEUE_NAME || 'logsentinel:jobs',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    notifyWebhookUrl: process.env.NOTIFY_WEBHOOK_URL || '',
  };
}

module.exports = { loadEnv };
