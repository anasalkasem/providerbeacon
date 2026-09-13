#!/usr/bin/env bash
set -euo pipefail
base_url="https://providerbeacon-production.up.railway.app"
expected_asset="index-DiBtFBVb.js"
for attempt in $(seq 1 24); do
  html="$(curl -fsS --max-time 20 "$base_url/?deploy_check=$attempt" || true)"
  if grep -q "$expected_asset" <<<"$html"; then
    health_code="$(curl -sS -o /tmp/providerbeacon-health.json -w '%{http_code}' --max-time 20 "$base_url/health")"
    home_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$base_url/?lang=ar")"
    printf 'deployed=yes attempt=%s home=%s health=%s asset=%s\n' "$attempt" "$home_code" "$health_code" "$expected_asset"
    cat /tmp/providerbeacon-health.json
    exit 0
  fi
  printf 'waiting attempt=%s\n' "$attempt"
  sleep 15
done
printf 'deployed=no expected_asset=%s\n' "$expected_asset" >&2
exit 1
