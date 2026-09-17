/**
 * Canned demo logs with pre-written analysis, used only by the (off-by-default)
 * DEMO_MODE feature. No Claude call ever produces this content — it's written
 * here directly so the public demo has zero per-click AI cost.
 *
 * Grouped into named "clusters" so the seed route can stagger them into the
 * dashboard as if a worker batch had just finished analyzing each group.
 */

const ROUTINE = [
  {
    level: 'info',
    message: 'Request completed in 142ms',
    source: 'api-gateway',
    analysis: { summary: 'Normal request latency', severity: 'none' },
  },
  {
    level: 'info',
    message: 'GET /api/users 200',
    source: 'api-gateway',
    analysis: { summary: 'Successful API request', severity: 'none' },
  },
  {
    level: 'debug',
    message: 'Cache hit for key user:4821',
    source: 'api-gateway',
    analysis: { summary: 'Cache functioning as expected', severity: 'none' },
  },
  {
    level: 'info',
    message: 'User 7734 logged in',
    source: 'auth-service',
    analysis: { summary: 'Successful login', severity: 'none' },
  },
  {
    level: 'debug',
    message: 'Scheduled job "cleanup" started',
    source: 'worker',
    analysis: { summary: 'Routine scheduled job execution', severity: 'none' },
  },
  {
    level: 'info',
    message: 'GET /api/orders 200',
    source: 'api-gateway',
    analysis: { summary: 'Successful API request', severity: 'none' },
  },
  {
    level: 'debug',
    message: 'Cache hit for key user:1092',
    source: 'api-gateway',
    analysis: { summary: 'Cache functioning as expected', severity: 'none' },
  },
  {
    level: 'info',
    message: 'User 2260 logged in',
    source: 'auth-service',
    analysis: { summary: 'Successful login', severity: 'none' },
  },
  {
    level: 'warn',
    message: 'Slow query detected (620ms)',
    source: 'db',
    analysis: {
      summary: 'Query latency above normal but not yet critical',
      severity: 'low',
    },
  },
  {
    level: 'info',
    message: 'Request completed in 88ms',
    source: 'api-gateway',
    analysis: { summary: 'Normal request latency', severity: 'none' },
  },
  {
    level: 'debug',
    message: 'Scheduled job "digest" started',
    source: 'worker',
    analysis: { summary: 'Routine scheduled job execution', severity: 'none' },
  },
  {
    level: 'info',
    message: 'GET /api/health 200',
    source: 'api-gateway',
    analysis: { summary: 'Health check passing', severity: 'none' },
  },
  {
    level: 'info',
    message: 'User 5518 logged in',
    source: 'auth-service',
    analysis: { summary: 'Successful login', severity: 'none' },
  },
];

const CLUSTERS = [
  {
    name: 'bruteForce',
    recommendation: 'Enable rate limiting and temporary lockout on /auth/login for this IP.',
    logs: [
      {
        level: 'warn',
        message: 'Failed login for user14@example.com',
        source: 'auth-service',
        metadata: { ip: '203.0.113.44', reason: 'bad_password' },
        summary: 'Failed login attempt',
        severity: 'medium',
      },
      {
        level: 'warn',
        message: 'Failed login for user27@example.com',
        source: 'auth-service',
        metadata: { ip: '203.0.113.44', reason: 'bad_password' },
        summary: 'Repeated failed login from same IP',
        severity: 'medium',
      },
      {
        level: 'warn',
        message: 'Failed login for user09@example.com',
        source: 'auth-service',
        metadata: { ip: '203.0.113.44', reason: 'bad_password' },
        summary: 'Repeated failed login from same IP',
        severity: 'high',
      },
      {
        level: 'warn',
        message: 'Failed login for user33@example.com',
        source: 'auth-service',
        metadata: { ip: '203.0.113.44', reason: 'bad_password' },
        summary: 'Pattern consistent with credential-stuffing attempt',
        severity: 'high',
      },
      {
        level: 'error',
        message: 'Account locked after repeated failed logins',
        source: 'auth-service',
        metadata: { ip: '203.0.113.44', reason: 'lockout_triggered' },
        summary: 'Brute-force pattern confirmed; lockout engaged',
        severity: 'critical',
      },
    ],
  },
  {
    name: 'outage',
    recommendation: 'Check upstream health and database connection pool sizing.',
    logs: [
      {
        level: 'error',
        message: 'Connection timeout to upstream service',
        source: 'payments-service',
        metadata: { upstream: 'payments-service' },
        summary: 'Upstream request timed out',
        severity: 'high',
      },
      {
        level: 'error',
        message: 'Upstream returned 503 Service Unavailable',
        source: 'payments-service',
        metadata: { upstream: 'payments-service' },
        summary: 'Upstream service unavailable',
        severity: 'high',
      },
      {
        level: 'error',
        message: 'Database connection pool exhausted',
        source: 'db',
        metadata: { pool: 'primary' },
        summary: 'Connection pool exhaustion during outage',
        severity: 'critical',
      },
      {
        level: 'error',
        message: 'Connection timeout to upstream service',
        source: 'inventory-service',
        metadata: { upstream: 'inventory-service' },
        summary: 'Second upstream also timing out',
        severity: 'critical',
      },
    ],
  },
  {
    name: 'resourcePressure',
    recommendation: 'Scale the affected host or free disk/memory before it triggers an outage.',
    logs: [
      {
        level: 'warn',
        message: 'Disk usage at 91%',
        source: 'worker-1',
        metadata: { host: 'worker-1' },
        summary: 'Disk usage approaching capacity',
        severity: 'medium',
      },
      {
        level: 'warn',
        message: 'Disk usage at 96%',
        source: 'worker-1',
        metadata: { host: 'worker-1' },
        summary: 'Disk usage critical',
        severity: 'high',
      },
      {
        level: 'warn',
        message: 'Memory usage critical',
        source: 'worker-1',
        metadata: { host: 'worker-1' },
        summary: 'Memory pressure rising alongside disk usage',
        severity: 'high',
      },
      {
        level: 'fatal',
        message: 'Out of memory: killed process',
        source: 'worker-1',
        metadata: { host: 'worker-1' },
        summary: 'OOM killer terminated a process',
        severity: 'critical',
      },
    ],
  },
  {
    name: 'regression',
    recommendation: 'Roll back deploy v1.42.0 or ship a hotfix for the null metadata case.',
    logs: [
      {
        level: 'error',
        message: 'TypeError: Cannot read properties of undefined',
        source: 'order-service',
        metadata: { deploy: 'v1.42.0' },
        summary: 'New error type introduced after recent deploy',
        severity: 'high',
      },
      {
        level: 'error',
        message: 'Unhandled promise rejection in OrderService',
        source: 'order-service',
        metadata: { deploy: 'v1.42.0' },
        summary: 'Unhandled rejection correlated with same deploy',
        severity: 'high',
      },
      {
        level: 'error',
        message: 'ValidationError: schema mismatch on /orders',
        source: 'order-service',
        metadata: { deploy: 'v1.42.0' },
        summary: 'Schema mismatch suggests incompatible client/server versions',
        severity: 'high',
      },
    ],
  },
];

// Fixed chunk sizes matching buildFixtures()'s output order: two routine
// chunks (7 + 6) then one chunk per incident cluster. The seed route slices
// the inserted docs (in this same order) using these sizes to simulate
// worker batches flipping from "processing" to "done" together.
const CHUNK_SIZES = [7, 6, ...CLUSTERS.map((c) => c.logs.length)];

function buildFixtures() {
  const fixtures = [...ROUTINE.slice(0, 7), ...ROUTINE.slice(7)];

  for (const cluster of CLUSTERS) {
    for (const log of cluster.logs) {
      fixtures.push({
        level: log.level,
        message: log.message,
        source: log.source,
        metadata: log.metadata,
        cluster: cluster.name,
        analysis: {
          summary: log.summary,
          severity: log.severity,
          recommendation: cluster.recommendation,
        },
      });
    }
  }

  return fixtures;
}

module.exports = { buildFixtures, CHUNK_SIZES, ROUTINE, CLUSTERS };
