const ApiKey = require('../models/ApiKey');
const { hashApiKey } = require('../utils/apiKey');

async function requireApiKey(req, res, next) {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  const keyHash = hashApiKey(rawKey, req.app.locals.config.apiKeySalt);
  const apiKey = await ApiKey.findOne({ keyHash });

  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  apiKey.lastUsedAt = new Date();
  await apiKey.save();

  req.apiKey = apiKey;
  req.user = { id: apiKey.userId.toString() };
  next();
}

module.exports = { requireApiKey };
