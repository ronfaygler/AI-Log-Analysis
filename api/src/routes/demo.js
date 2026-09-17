const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const LogEntry = require('../models/LogEntry');
const { generateApiKey, hashApiKey, keyPrefix } = require('../utils/apiKey');
const { setAuthCookie } = require('./auth');
const {
  tryAcquireLock,
  getValue,
  setValue,
  publishLogEvent,
  invalidateUserLogCaches,
} = require('../db/redis');
const { buildFixtures, CHUNK_SIZES } = require('../data/demoFixtures');

const DEMO_USER_EMAIL = 'demo@logsentinel.local';
const IDLE_CLEAR_MS = 10 * 60 * 1000;
const SEED_LOCK_KEY = 'demo:seed:lock';
const SEED_LOCK_TTL_SECONDS = 10;
const LAST_SEEDED_KEY = 'demo:lastSeededAt';

const router = express.Router();

async function getOrCreateDemoUser() {
  let user = await User.findOne({ email: DEMO_USER_EMAIL });
  if (!user) {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    user = await User.create({ email: DEMO_USER_EMAIL, passwordHash });
  }
  return user;
}

async function getOrCreateDemoApiKey(demoUserId, apiKeySalt) {
  let key = await ApiKey.findOne({ userId: demoUserId, name: 'demo-seed' });
  if (!key) {
    const raw = generateApiKey();
    key = await ApiKey.create({
      userId: demoUserId,
      name: 'demo-seed',
      keyHash: hashApiKey(raw, apiKeySalt),
      keyPrefix: keyPrefix(raw),
    });
  }
  return key;
}

router.post('/demo/login', async (req, res, next) => {
  try {
    const demoUser = await getOrCreateDemoUser();

    const raw = await getValue(LAST_SEEDED_KEY);
    const lastSeededAt = raw ? Number(raw) : null;
    if (lastSeededAt && Date.now() - lastSeededAt > IDLE_CLEAR_MS) {
      await LogEntry.deleteMany({ userId: demoUser._id });
      await invalidateUserLogCaches(demoUser._id);
    }

    setAuthCookie(res, demoUser, req.app.locals.config);
    res.json({ user: { id: demoUser._id, email: demoUser.email } });
  } catch (err) {
    next(err);
  }
});

router.post('/demo/clear', async (req, res, next) => {
  try {
    const demoUser = await getOrCreateDemoUser();
    await LogEntry.deleteMany({ userId: demoUser._id });
    await invalidateUserLogCaches(demoUser._id);
    res.json({ cleared: true });
  } catch (err) {
    next(err);
  }
});

router.post('/demo/seed', async (req, res, next) => {
  try {
    const acquired = await tryAcquireLock(SEED_LOCK_KEY, SEED_LOCK_TTL_SECONDS);
    if (!acquired) {
      return res.status(429).json({ error: 'Demo was just regenerated, try again shortly' });
    }

    const demoUser = await getOrCreateDemoUser();
    const demoApiKey = await getOrCreateDemoApiKey(demoUser._id, req.app.locals.config.apiKeySalt);

    await invalidateUserLogCaches(demoUser._id);

    const fixtures = buildFixtures();
    const now = Date.now();
    const docs = fixtures.map((fixture, i) => ({
      userId: demoUser._id,
      apiKeyId: demoApiKey._id,
      level: fixture.level,
      message: fixture.message,
      source: fixture.source,
      metadata: fixture.metadata,
      loggedAt: new Date(now + i),
      status: 'queued',
    }));

    const inserted = await LogEntry.insertMany(docs);
    await setValue(LAST_SEEDED_KEY, String(now));

    res.status(202).json({ seeded: inserted.length });

    const timing = req.app.locals.config.demoSimTiming || DEFAULT_TIMING;
    simulatePipeline(inserted, fixtures, demoUser._id, timing).catch((err) => {
      console.error('Demo pipeline simulation failed:', err.message);
    });
  } catch (err) {
    next(err);
  }
});

const DEFAULT_TIMING = {
  initialDelayMs: 800,
  perDocDelayMs: 60,
  processingDelayMs: () => 1000 + Math.random() * 400,
  interChunkDelayMs: () => 1500 + Math.random() * 500,
};

async function simulatePipeline(inserted, fixtures, demoUserId, timing) {
  await sleep(timing.initialDelayMs);

  let offset = 0;
  for (const size of CHUNK_SIZES) {
    const chunkDocs = inserted.slice(offset, offset + size);
    const chunkFixtures = fixtures.slice(offset, offset + size);
    offset += size;

    await LogEntry.updateMany(
      { _id: { $in: chunkDocs.map((d) => d._id) } },
      { $set: { status: 'processing' } }
    );
    for (const doc of chunkDocs) {
      await publishLogEvent(demoUserId, doc._id);
      await sleep(timing.perDocDelayMs);
    }

    await sleep(timing.processingDelayMs());

    for (let i = 0; i < chunkDocs.length; i++) {
      const analysis = { ...chunkFixtures[i].analysis, analyzedAt: new Date() };
      const complete = Boolean(analysis.summary && analysis.recommendation);
      await LogEntry.updateOne(
        { _id: chunkDocs[i]._id },
        {
          $set: complete
            ? { status: 'done', analysis }
            : { status: 'failed', errorMessage: 'Demo fixture missing summary or recommendation' },
        }
      );
      await publishLogEvent(demoUserId, chunkDocs[i]._id);
      await sleep(timing.perDocDelayMs);
    }

    await sleep(timing.interChunkDelayMs());
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = router;
module.exports.DEMO_USER_EMAIL = DEMO_USER_EMAIL;
module.exports.simulatePipeline = simulatePipeline;
