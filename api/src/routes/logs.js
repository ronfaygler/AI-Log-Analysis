const express = require('express');
const LogEntry = require('../models/LogEntry');
const { requireApiKey } = require('../middleware/authApiKey');
const { requireAuth } = require('../middleware/authJwt');
const {
  publishJob,
  getCacheJson,
  setCacheJson,
  publishLogEvent,
  invalidateUserLogCaches,
  deleteCacheKey,
} = require('../db/redis');
const { listCacheKey, detailCacheKey } = require('../utils/logCache');
const { LEVELS, parseTruthy, buildListFilter, sortLogsBySeverity } = require('../utils/logQuery');
const { createLogsStreamRouter } = require('./logsStream');

const router = express.Router();

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
    await invalidateUserLogCaches(req.user.id);
    await publishLogEvent(req.user.id, entry._id);

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
    const built = buildListFilter(req.user.id, req.query);
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    const sortMode = req.query.sort === 'severity' ? 'severity' : 'time';
    if (req.query.sort && sortMode !== 'severity' && req.query.sort !== 'time') {
      return res.status(400).json({ error: 'sort must be one of: time, severity' });
    }

    const config = req.app.locals.config;
    const cacheKey = listCacheKey(req.user.id, {
      limit,
      level: req.query.level,
      status: req.query.status,
      source: req.query.source,
      q: req.query.q,
      issues: req.query.issues,
      severity: req.query.severity,
      sort: req.query.sort,
    });

    const skipCache = parseTruthy(req.query.fresh);
    if (!skipCache) {
      const cached = await getCacheJson(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    let logs = await LogEntry.find(built.filter)
      .sort({ loggedAt: -1 })
      .limit(limit)
      .select('-__v')
      .lean();

    if (sortMode === 'severity') {
      logs = sortLogsBySeverity(logs);
    }

    const payload = { logs, limit };
    await setCacheJson(cacheKey, payload, config.logsCacheTtlSeconds);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.use(createLogsStreamRouter());

router.delete('/logs/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await LogEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!deleted) {
      return res.status(404).json({ error: 'Log not found' });
    }

    await deleteCacheKey(detailCacheKey(req.user.id, req.params.id));
    await invalidateUserLogCaches(req.user.id);
    await publishLogEvent(req.user.id, req.params.id, 'log.deleted');

    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
});

router.get('/logs/:id', requireAuth, async (req, res, next) => {
  try {
    const config = req.app.locals.config;
    const cacheKey = detailCacheKey(req.user.id, req.params.id);
    const cached = await getCacheJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const log = await LogEntry.findOne({ _id: req.params.id, userId: req.user.id })
      .select('-__v')
      .lean();
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }
    const payload = { log };
    await setCacheJson(cacheKey, payload, config.logsCacheTtlSeconds);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
