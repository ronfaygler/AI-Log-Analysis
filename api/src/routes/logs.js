const express = require('express');
const LogEntry = require('../models/LogEntry');
const { requireApiKey } = require('../middleware/authApiKey');
const { requireAuth } = require('../middleware/authJwt');
const { publishJob } = require('../db/redis');

const router = express.Router();
const LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal']);

router.post('/logs/ingest', requireApiKey, async (req, res, next) => {
  try {
    const { level, message, source, metadata, timestamp } = req.body;

    if (!level || !LEVELS.has(level)) {
      return res.status(400).json({ error: 'level must be one of: debug, info, warn, error, fatal' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const loggedAt = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(loggedAt.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    const entry = await LogEntry.create({
      userId: req.user.id,
      apiKeyId: req.apiKey._id,
      level,
      message,
      source,
      metadata,
      loggedAt,
      status: 'queued',
    });

    const job = {
      type: 'analyze_log',
      logEntryId: entry._id.toString(),
      userId: req.user.id,
      level,
      message,
      source,
      metadata,
      loggedAt: loggedAt.toISOString(),
      enqueuedAt: new Date().toISOString(),
    };

    const config = req.app.locals.config;
    await publishJob(config.redisQueueName, job);

    res.status(202).json({
      id: entry._id,
      status: entry.status,
      queued: true,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const logs = await LogEntry.find({ userId: req.user.id })
      .sort({ loggedAt: -1 })
      .limit(limit)
      .select('-__v');

    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
