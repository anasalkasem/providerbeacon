# Railway Deployment

ProviderBeacon includes a multi-stage `Dockerfile` and a public `/health` endpoint for Railway deployments.

## Deploy from GitHub

Create a Railway project from `anasalkasem/providerbeacon`. Railway detects the root `Dockerfile`, builds the React application and Express server, then runs `node dist/index.js`. Generate a Railway domain under **Settings → Networking** and set the healthcheck path to `/health`.

## Environment variables

The public marketplace runs with only `NODE_ENV=production`; when `DATABASE_URL` is absent it serves versioned fallback data. Add a Railway MySQL service, reference its connection string as `DATABASE_URL`, and set `RUN_DATABASE_MIGRATIONS=true` only for the new Railway database so the container applies the bundled Drizzle migrations before listening.

To enable the current Manus OAuth integration outside the managed preview, Railway requires `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `JWT_SECRET`, `OWNER_OPEN_ID` and `DATABASE_URL`, plus an OAuth redirect URI matching the production domain. Built-in AI analysis additionally requires `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`; without them, only the AI action fails and the marketplace remains available. For a portable production launch, replacing Manus OAuth with a provider-independent authentication system remains recommended before onboarding external staff.

Never copy an existing managed database URL into Railway. Provision a dedicated Railway database and let the initial migration create its schema. Provider integration API keys are intentionally not stored; scheduled refresh requires a future secrets-manager design rather than database plaintext.

## Custom domain

After the Railway-generated domain is healthy, add `providerbeacon.com` in Railway's public networking settings. Railway provides the required CNAME and TXT records. Add both records in Namecheap Advanced DNS, wait for verification, and allow Railway to provision the TLS certificate automatically.

Do not remove the Railway-generated domain until the custom domain is verified and HTTPS works.
