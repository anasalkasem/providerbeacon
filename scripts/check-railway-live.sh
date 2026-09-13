#!/usr/bin/env bash
set -euo pipefail

base_url="https://providerbeacon-production.up.railway.app"
for attempt in $(seq 1 60); do
  status=$(curl -sS -o /tmp/providerbeacon-railway-health.json -w '%{http_code}' --max-time 15 "$base_url/health" || true)
  if [[ "$status" == "200" ]] && grep -q '"status":"healthy"' /tmp/providerbeacon-railway-health.json; then
    home_status=$(curl -sS -o /tmp/providerbeacon-railway-home.html -w '%{http_code}' --max-time 20 "$base_url/" || true)
    if [[ "$home_status" == "200" ]] && grep -q 'ProviderBeacon' /tmp/providerbeacon-railway-home.html; then
      echo "railway_live=yes"
      echo "health_http=$status"
      echo "home_http=$home_status"
      echo "url=$base_url"
      exit 0
    fi
  fi
  echo "attempt=$attempt health_http=${status:-none} waiting=10s"
  sleep 10
done

echo "railway_live=no"
exit 1
