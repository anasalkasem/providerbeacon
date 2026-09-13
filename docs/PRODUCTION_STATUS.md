# ProviderBeacon Production Status

**Verified:** 13 September 2026

## Live endpoints

| Endpoint | Status | Purpose |
|---|---:|---|
| <https://providerbeacon.com> | HTTP 200 over HTTPS | Primary production domain |
| <https://www.providerbeacon.com> | HTTP 200 over HTTPS | `www` production domain |
| <https://providerbeacon.com/health> | HTTP 200 over HTTPS | Railway healthcheck |
| <https://providerbeacon-production.up.railway.app> | HTTP 200 over HTTPS | Railway fallback domain |

Both custom domains returned the ProviderBeacon application shell with valid TLS certificates. Railway routes the service to application port `8080` and checks `/health` during deployments.

## Production data

The application is connected to a dedicated Railway MySQL service through a private Railway variable reference. Drizzle migrations were applied on startup, the marketplace seed was inserted idempotently, and the public `marketplace.snapshot` tRPC endpoint was verified with `source: database` and populated provider data.

## DNS records

| Type | Host | Value |
|---|---|---|
| CNAME | `@` | `7q9lr4dt.up.railway.app` |
| TXT | `_railway-verify` | `railway-verify=bd603d649b97f585d3fd7d8ba5726895bb772eac404a806568ff54b194ed5aaf` |
| CNAME | `www` | `z36qqez1.up.railway.app` |
| TXT | `_railway-verify.www` | `railway-verify=817ba2caa548cfbdc5254e50ac65e08e9e30f665f506cf3e3244c4359e9887a0` |

The existing Private Email DKIM record was preserved.

## Release verification

The release passed TypeScript checking, Vitest suites, the production Vite/esbuild build, Git diff validation, Railway `/health`, production-database source verification, and custom-domain HTTPS checks for both apex and `www`.

The independent security flow was also exercised against the live domain. The test recovered the owner through the secret-manager bootstrap token, verified owner permissions, enabled TOTP MFA, signed out, required MFA on the next login, consumed one recovery code, invited and registered an auditor account, confirmed least-privilege access, created and rotated an encrypted provider credential, and verified the corresponding audit events. The production startup after the independent-auth change contains the database migration and server-ready messages without the previous OAuth configuration error.
