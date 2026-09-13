#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
pnpm check
pnpm test
pnpm build

PORT=4010 NODE_ENV=production node dist/index.js > /tmp/providerbeacon-railway.log 2>&1 &
pid=$!
cleanup() {
  kill "$pid" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4010/health > /tmp/providerbeacon-health.json; then
    break
  fi
  sleep 0.5
done

curl -fsS http://127.0.0.1:4010/health
printf '\n'
curl -fsS http://127.0.0.1:4010/ > /tmp/providerbeacon-home.html
grep -q 'ProviderBeacon' /tmp/providerbeacon-home.html
echo "production_home=ok"
