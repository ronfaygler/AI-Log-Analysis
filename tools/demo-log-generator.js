#!/usr/bin/env node
'use strict';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      args._ = argv.slice(i + 1);
      break;
    }
    if (a.startsWith('--')) {
      const [flag, inlineVal] = a.slice(2).split('=');
      if (inlineVal !== undefined) {
        args[flag] = inlineVal;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[flag] = next;
        i++;
      } else {
        args[flag] = true;
      }
    }
  }
  return args;
}

async function postLog(baseUrl, apiKey, entry) {
  try {
    const res = await fetch(`${baseUrl}/logs/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      process.stderr.write(`[demo-log-generator] ingest failed (${res.status}): ${body}\n`);
    }
  } catch (err) {
    process.stderr.write(`[demo-log-generator] ingest error: ${err.message}\n`);
  }
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

function randId() {
  return rand(1000, 9999);
}

function fakeIp() {
  return `203.0.113.${rand(2, 254)}`;
}

const ROUTINE = [
  { level: 'info', weight: 5, msg: () => `Request completed in ${rand(20, 400)}ms` },
  { level: 'info', weight: 4, msg: () => `GET /api/${pick(['users', 'orders', 'products', 'health'])} 200` },
  { level: 'debug', weight: 3, msg: () => `Cache hit for key user:${randId()}` },
  { level: 'info', weight: 3, msg: () => `User ${randId()} logged in` },
  { level: 'debug', weight: 2, msg: () => `Scheduled job "${pick(['cleanup', 'sync', 'digest'])}" started` },
  { level: 'warn', weight: 1, msg: () => `Slow query detected (${rand(500, 900)}ms)` },
];
const ROUTINE_TABLE = ROUTINE.flatMap((r) => Array(r.weight).fill(r));

const SCENARIOS = {
  bruteForce: {
    burstLen: () => rand(10, 20),
    level: 'warn',
    msg: () => `Failed login for user${rand(1, 50)}@example.com`,
    metadata: (ctx) => ({ ip: ctx.ip, reason: 'bad_password' }),
    escalateLast: { level: 'error', msg: () => 'Account locked after repeated failed logins' },
  },
  outage: {
    burstLen: () => rand(8, 16),
    level: 'error',
    msg: () =>
      pick([
        'Connection timeout to upstream service',
        'Upstream returned 503 Service Unavailable',
        'Database connection pool exhausted',
      ]),
    metadata: () => ({ upstream: pick(['payments-service', 'inventory-service', 'db-primary']) }),
  },
  resourcePressure: {
    burstLen: () => rand(6, 12),
    level: 'warn',
    msg: () => pick([`Disk usage at ${rand(88, 97)}%`, 'Memory usage critical']),
    metadata: () => ({ host: pick(['worker-1', 'worker-2', 'api-1']) }),
    escalateLast: { level: 'fatal', msg: () => 'Out of memory: killed process' },
  },
  regression: {
    burstLen: () => rand(8, 14),
    level: 'error',
    msg: () =>
      pick([
        'TypeError: Cannot read properties of undefined',
        'Unhandled promise rejection in OrderService',
        'ValidationError: schema mismatch on /orders',
      ]),
    metadata: () => ({ deploy: `v1.${rand(10, 99)}.0` }),
  },
};

function emitRoutine(baseUrl, apiKey, source) {
  const entry = pick(ROUTINE_TABLE);
  postLog(baseUrl, apiKey, { level: entry.level, message: entry.msg(), source });
}

function emitFromScenario(baseUrl, apiKey, source, burst) {
  const { scenario, remaining, ctx } = burst;
  const isLast = remaining === 1 && scenario.escalateLast;
  const level = isLast ? scenario.escalateLast.level : scenario.level;
  const message = isLast ? scenario.escalateLast.msg() : scenario.msg();
  const metadata = scenario.metadata ? scenario.metadata(ctx) : undefined;
  postLog(baseUrl, apiKey, { level, message, source, metadata });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const usage =
    'Usage: node tools/demo-log-generator.js --key <apiKey> [--url http://localhost:4000] [--source demo-generator] [--interval-ms 1500] [--burst-chance 0.03] [--max-logs n]';

  if (!args.key || typeof args.key !== 'string') {
    console.error(usage);
    process.exit(1);
  }

  const baseUrl = (typeof args.url === 'string' && args.url) || 'http://localhost:4000';
  const source = typeof args.source === 'string' ? args.source : 'demo-generator';
  const intervalMs = Number(args['interval-ms']) || 1500;
  const burstChance = args['burst-chance'] !== undefined ? Number(args['burst-chance']) : 0.03;
  const maxLogs = args['max-logs'] !== undefined ? Number(args['max-logs']) : Infinity;

  let burst = null;
  let stopped = false;
  let shipped = 0;

  function tick() {
    if (stopped) return;

    if (shipped >= maxLogs) {
      stopped = true;
      console.error(`[demo-log-generator] reached --max-logs limit (${maxLogs}); stopping.`);
      return;
    }

    if (burst) {
      emitFromScenario(baseUrl, args.key, source, burst);
      burst.remaining--;
      if (burst.remaining <= 0) burst = null;
      shipped++;
    } else if (Math.random() < burstChance) {
      const key = pick(Object.keys(SCENARIOS));
      const scenario = SCENARIOS[key];
      burst = { scenario, remaining: scenario.burstLen(), ctx: { ip: fakeIp() } };
    } else {
      emitRoutine(baseUrl, args.key, source);
      shipped++;
    }

    const jitter = 0.6 + Math.random() * 0.8;
    setTimeout(tick, Math.round(intervalMs * jitter));
  }

  console.error(`[demo-log-generator] shipping to ${baseUrl}/logs/ingest every ~${intervalMs}ms (Ctrl+C to stop)`);
  tick();

  const shutdown = () => {
    stopped = true;
    console.error('\n[demo-log-generator] stopping...');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
