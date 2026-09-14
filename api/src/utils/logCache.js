function listCacheKey(userId, query) {
  const parts = [
    'logs:list',
    userId,
    query.limit ?? '50',
    query.page ?? '1',
    query.level ?? '',
    query.status ?? '',
    query.source ?? '',
    query.q ?? '',
    query.issues ?? '',
    query.severity ?? '',
    query.sort ?? '',
  ];
  return parts.join(':');
}

function listCachePattern(userId) {
  return `logs:list:${userId}:*`;
}

function detailCacheKey(userId, logId) {
  return `logs:detail:${userId}:${logId}`;
}

module.exports = { listCacheKey, detailCacheKey, listCachePattern };
