const express = require('express');
const ApiKey = require('../models/ApiKey');
const { requireAuth } = require('../middleware/authJwt');
const { generateApiKey, hashApiKey, keyPrefix } = require('../utils/apiKey');

const router = express.Router();

router.use(requireAuth);

router.post('/keys', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Key name required' });
    }

    const rawKey = generateApiKey();
    const config = req.app.locals.config;
    const doc = await ApiKey.create({
      userId: req.user.id,
      name: name.trim(),
      keyHash: hashApiKey(rawKey, config.apiKeySalt),
      keyPrefix: keyPrefix(rawKey),
    });

    res.status(201).json({
      id: doc._id,
      name: doc.name,
      keyPrefix: doc.keyPrefix,
      key: rawKey,
      message: 'Store this key now — it will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/keys', async (req, res, next) => {
  try {
    const keys = await ApiKey.find({ userId: req.user.id })
      .select('name keyPrefix lastUsedAt createdAt')
      .sort({ createdAt: -1 });

    res.json({ keys });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
