const LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const STATUSES = new Set(['queued', 'processing', 'done', 'failed']);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical', 'none']);
const ISSUE_SEVERITIES = ['medium', 'high', 'critical'];
const ERROR_LEVELS = ['error', 'fatal'];
const IN_FLIGHT_STATUSES = ['queued', 'processing'];

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

function parseTruthy(value) {
  return value === '1' || value === 'true';
}

function buildIssuesOr() {
  return [
    { status: 'failed' },
    { 'analysis.severity': { $in: ISSUE_SEVERITIES } },
    {
      level: { $in: ERROR_LEVELS },
      status: { $in: IN_FLIGHT_STATUSES },
    },
  ];
}

function buildListFilter(userId, query) {
  const filter = { userId };

  if (query.level) {
    if (!LEVELS.has(query.level)) {
      return { error: 'level must be one of: debug, info, warn, error, fatal' };
    }
    filter.level = query.level;
  }
  if (query.status) {
    if (!STATUSES.has(query.status)) {
      return { error: 'status must be one of: queued, processing, done, failed' };
    }
    filter.status = query.status;
  }
  if (query.source) {
    filter.source = query.source;
  }
  if (query.q) {
    filter.message = { $regex: query.q, $options: 'i' };
  }
  if (parseTruthy(query.issues)) {
    filter.$or = buildIssuesOr();
  }
  if (query.severity) {
    if (!SEVERITIES.has(query.severity)) {
      return { error: 'severity must be one of: low, medium, high, critical, none' };
    }
    if (query.severity === 'none') {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { 'analysis.severity': { $exists: false } },
            { 'analysis.severity': null },
            { 'analysis.severity': 'none' },
          ],
        },
      ];
    } else {
      filter['analysis.severity'] = query.severity;
    }
  }

  return { filter };
}

function sortLogsBySeverity(logs) {
  return [...logs].sort((a, b) => {
    const rankA = SEVERITY_RANK[a.analysis?.severity] ?? SEVERITY_RANK.none;
    const rankB = SEVERITY_RANK[b.analysis?.severity] ?? SEVERITY_RANK.none;
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b.loggedAt) - new Date(a.loggedAt);
  });
}

module.exports = {
  LEVELS,
  STATUSES,
  SEVERITIES,
  parseTruthy,
  buildListFilter,
  sortLogsBySeverity,
};
