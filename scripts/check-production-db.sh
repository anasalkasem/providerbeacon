#!/usr/bin/env bash
set -euo pipefail
base_url="https://providerbeacon-production.up.railway.app"
for attempt in $(seq 1 36); do
  health_code=$(curl -sS -o /tmp/providerbeacon-production-health.json -w '%{http_code}' --max-time 15 "$base_url/health" || true)
  snapshot=$(curl -sS --max-time 20 "$base_url/api/trpc/marketplace.snapshot?input=%7B%22json%22%3Anull%7D" || true)
  if [[ "$health_code" == "200" ]] && [[ "$snapshot" == *'"source":"database"'* ]] && [[ "$snapshot" == *'Northstar Social'* ]]; then
    printf '%s\n' "production_database=ready attempt=$attempt"
    printf '%s' "$snapshot" > /tmp/providerbeacon-production-snapshot.json
    exit 0
  fi
  printf '%s\n' "production_database=waiting attempt=$attempt health=$health_code"
  sleep 10
done
printf '%s\n' 'production_database=timeout' >&2
exit 1
