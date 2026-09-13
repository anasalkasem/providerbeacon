#!/usr/bin/env bash
set -euo pipefail
root="https://providerbeacon.com"
www="https://www.providerbeacon.com"
for attempt in $(seq 1 60); do
  root_code=$(curl -L -sS -o /tmp/providerbeacon-root.html -w '%{http_code}' --max-time 20 "$root/" || true)
  www_code=$(curl -L -sS -o /tmp/providerbeacon-www.html -w '%{http_code}' --max-time 20 "$www/" || true)
  health_code=$(curl -sS -o /tmp/providerbeacon-domain-health.json -w '%{http_code}' --max-time 20 "$root/health" || true)
  if [[ "$root_code" == "200" ]] && [[ "$www_code" == "200" ]] && [[ "$health_code" == "200" ]] \
    && grep -q 'ProviderBeacon' /tmp/providerbeacon-root.html \
    && grep -q 'ProviderBeacon' /tmp/providerbeacon-www.html; then
    printf '%s\n' "custom_domains=ready attempt=$attempt root=$root_code www=$www_code health=$health_code"
    exit 0
  fi
  printf '%s\n' "custom_domains=waiting attempt=$attempt root=$root_code www=$www_code health=$health_code"
  sleep 10
done
printf '%s\n' 'custom_domains=timeout' >&2
exit 1
