# Railway Deployment

ProviderBeacon includes a multi-stage `Dockerfile` and a public `/health` endpoint for Railway deployments.

## Deploy from GitHub

Create a Railway project from `anasalkasem/providerbeacon`. Railway detects the root `Dockerfile`, builds the React application and Express server, then runs `node dist/index.js`. Generate a Railway domain under **Settings → Networking** and set the healthcheck path to `/health`.

## Environment variables

The public marketplace runs with only `NODE_ENV=production`; when `DATABASE_URL` is absent it serves versioned fallback data. Add a Railway MySQL service, reference its connection string as `DATABASE_URL`, and set `RUN_DATABASE_MIGRATIONS=true` only for the new Railway database so the container applies the bundled Drizzle migrations before listening.

Independent staff authentication requires `AUTH_BOOTSTRAP_TOKEN` for the one-time owner creation, `AUTH_PEPPER` for recovery-code hashing, and `VAULT_MASTER_KEY` for AES-256-GCM encryption. Generate each independently with at least 32 random bytes and keep them only in Railway's server-side variable store. Remove `AUTH_BOOTSTRAP_TOKEN` after the first owner account is created.

Visitor email/password accounts reuse the existing database and security keys. Google sign-in requires server-only `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `PUBLIC_APP_URL=https://providerbeacon.com`. The exact callback is `https://providerbeacon.com/api/auth/google/callback`. See [visitor account activation](member-accounts.md) for Google Cloud configuration and recovery behavior.

The optional Manus OAuth fallback requires `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `JWT_SECRET` and `OWNER_OPEN_ID`. Built-in AI analysis additionally requires `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`; without them, only the AI action fails and the marketplace remains available.

Never copy an existing managed database URL into Railway. Provision a dedicated Railway database and let the initial migration create its schema. Provider API keys are encrypted before storage and must never be copied into source files, logs, browser storage or GitHub Actions secrets. The scheduled workflow uses GitHub OIDC and therefore needs no long-lived scheduler secret.

## Custom domain

After the Railway-generated domain is healthy, add `providerbeacon.com` in Railway's public networking settings. Railway provides the required CNAME and TXT records. Add both records in Namecheap Advanced DNS, wait for verification, and allow Railway to provision the TLS certificate automatically.

Do not remove the Railway-generated domain until the custom domain is verified and HTTPS works.
