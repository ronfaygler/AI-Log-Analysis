const required = ['MONGO_URI', 'REDIS_URL', 'JWT_SECRET', 'API_KEY_SALT'];

function loadEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: Number(process.env.PORT) || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGO_URI,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    apiKeySalt: process.env.API_KEY_SALT,
    redisQueueName: process.env.REDIS_QUEUE_NAME || 'logsentinel:jobs',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  };
}

module.exports = { loadEnv };
