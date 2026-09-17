const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const keysRoutes = require('./routes/keys');
const logsRoutes = require('./routes/logs');
const demoRoutes = require('./routes/demo');

function createApp(config) {
  const app = express();
  app.locals.config = config;

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(keysRoutes);
  app.use(logsRoutes);
  if (config.demoMode) {
    app.use(demoRoutes);
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
