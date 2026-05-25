const { loadEnv } = require('./config/env');
const { connectMongo } = require('./db/mongodb');
const { connectRedis } = require('./db/redis');
const { startConsumer } = require('./worker/consumer');

async function main() {
  const config = loadEnv();
  await connectMongo(config.mongoUri);
  await connectRedis(config.redisUrl);
  await startConsumer(config);
}

main().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
