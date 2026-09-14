function uniqueEmail(prefix = 'user') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
}

const testConfig = {
  port: 4000,
  nodeEnv: 'test',
  jwtSecret: 'test-jwt-secret-min-32-chars-long',
  jwtExpiresIn: '1h',
  apiKeySalt: 'test-api-key-salt',
  redisUrl: 'redis://localhost:6379',
  redisQueueName: 'logsentinel:test:jobs',
  cookieSecure: false,
  corsOrigin: 'http://localhost:3000',
  logsCacheTtlSeconds: 30,
};

module.exports = { testConfig, uniqueEmail };
