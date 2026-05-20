const crypto = require('crypto');

function hashApiKey(rawKey, salt) {
  return crypto.createHmac('sha256', salt).update(rawKey).digest('hex');
}

function generateApiKey() {
  const raw = crypto.randomBytes(24).toString('hex');
  return `ls_${raw}`;
}

function keyPrefix(rawKey) {
  return rawKey.slice(0, 12);
}

module.exports = { hashApiKey, generateApiKey, keyPrefix };
