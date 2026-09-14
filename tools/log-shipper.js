#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const readline = require('readline');

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

function inferLevel(line, isStderr) {
  if (/\bfatal\b/i.test(line)) return 'fatal';
  if (/\b(error|err|exception|failed|failure)\b/i.test(line)) return 'error';
  if (/\bwarn(ing)?\b/i.test(line)) return 'warn';
  if (/\bdebug\b/i.test(line)) return 'debug';
  if (/\binfo\b/i.test(line)) return 'info';
  return isStderr ? 'error' : 'info';
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
      process.stderr.write(`[log-shipper] ingest failed (${res.status}): ${body}\n`);
    }
  } catch (err) {
    process.stderr.write(`[log-shipper] ingest error: ${err.message}\n`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const usage =
    'Usage: node tools/log-shipper.js --key <apiKey> [--url http://localhost:4000] [--source name] [--max-logs n] -- <command> [args...]';

  if (!args.key || typeof args.key !== 'string') {
    console.error(usage);
    process.exit(1);
  }
  if (!args._.length) {
    console.error(usage);
    console.error('Missing command to run after "--"');
    process.exit(1);
  }

  const baseUrl = (typeof args.url === 'string' && args.url) || 'http://localhost:4000';
  const source = typeof args.source === 'string' ? args.source : undefined;
  const maxLogs = args['max-logs'] !== undefined ? Number(args['max-logs']) : Infinity;
  const [cmd, ...cmdArgs] = args._;

  const child = spawn(cmd, cmdArgs, { shell: false });
  const pending = new Set();
  let shipped = 0;
  let limitNotified = false;

  child.on('error', (err) => {
    console.error(`[log-shipper] failed to start "${cmd}": ${err.message}`);
    process.exit(1);
  });

  function wire(stream, out, isStderr) {
    const rl = readline.createInterface({ input: stream });
    rl.on('line', (line) => {
      out.write(line + '\n');

      if (shipped >= maxLogs) {
        if (!limitNotified) {
          limitNotified = true;
          process.stderr.write(
            `[log-shipper] reached --max-logs limit (${maxLogs}); no longer shipping (app keeps running)\n`
          );
        }
        return;
      }
      shipped++;

      const p = postLog(baseUrl, args.key, {
        level: inferLevel(line, isStderr),
        message: line,
        source,
      });
      pending.add(p);
      p.finally(() => pending.delete(p));
    });
  }

  wire(child.stdout, process.stdout, false);
  wire(child.stderr, process.stderr, true);

  const forward = (signal) => () => child.kill(signal);
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));

  child.on('close', async (code, signal) => {
    await Promise.allSettled([...pending]);
    process.exitCode = code !== null ? code : signal ? 1 : 0;
  });
}

main();
