const { loadEnv } = require('./config/env');
const { connectMongo } = require('./db/mongodb');
const { connectRedis } = require('./db/redis');
const { createApp } = require('./app');

async function main() {
  const config = loadEnv();
  await connectMongo(config.mongoUri);
  await connectRedis(config.redisUrl);

  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`LogSentinel API listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
