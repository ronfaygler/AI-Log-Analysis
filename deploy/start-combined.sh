#!/bin/sh
set -e

(cd /app/worker && node src/index.js) &
WORKER_PID=$!

(cd /app/api && node src/index.js) &
API_PID=$!

term_handler() {
  kill -TERM "$WORKER_PID" "$API_PID" 2>/dev/null
}
trap term_handler TERM INT

wait "$API_PID"
API_EXIT=$?

kill -TERM "$WORKER_PID" 2>/dev/null
wait "$WORKER_PID" 2>/dev/null

exit "$API_EXIT"
