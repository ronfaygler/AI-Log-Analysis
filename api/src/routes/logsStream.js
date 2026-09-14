const express = require('express');
const Redis = require('ioredis');
const { requireAuth } = require('../middleware/authJwt');
const { logEventsChannel } = require('../db/redis');

function createLogsStreamRouter() {
  const router = express.Router();

  router.get('/logs/stream', requireAuth, (req, res) => {
    const config = req.app.locals.config;
    const channel = logEventsChannel(req.user.id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const subscriber = new Redis(config.redisUrl);

    const send = (payload) => {
      res.write(`event: ${payload.event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    subscriber.subscribe(channel, (err) => {
      if (err) {
        console.error('SSE subscribe error:', err.message);
        res.end();
        subscriber.quit();
      }
    });

    subscriber.on('message', (_ch, message) => {
      try {
        send(JSON.parse(message));
      } catch {
        // ignore malformed pub/sub payloads
      }
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit();
    });
  });

  return router;
}

module.exports = { createLogsStreamRouter };
