const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

jest.mock('../src/db/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue({}),
  getRedis: jest.fn(),
  publishJob: jest.fn().mockResolvedValue(undefined),
  getCacheJson: jest.fn().mockResolvedValue(null),
  setCacheJson: jest.fn().mockResolvedValue(undefined),
  publishLogEvent: jest.fn().mockResolvedValue(undefined),
  invalidateUserLogCaches: jest.fn().mockResolvedValue(undefined),
  deleteCacheKey: jest.fn().mockResolvedValue(undefined),
  logEventsChannel: jest.fn((userId) => `logsentinel:events:${userId}`),
  tryAcquireLock: jest.fn().mockResolvedValue(true),
  getValue: jest.fn().mockResolvedValue(null),
  setValue: jest.fn().mockResolvedValue(undefined),
}));

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
