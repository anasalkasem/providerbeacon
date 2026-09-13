# Railway Deployment

ProviderBeacon includes a multi-stage `Dockerfile` and a public `/health` endpoint for Railway deployments.

## Deploy from GitHub

Create a Railway project from `anasalkasem/providerbeacon`. Railway detects the root `Dockerfile`, builds the React application and Express server, then runs `node dist/index.js`. Generate a Railway domain under **Settings → Networking** and set the healthcheck path to `/health`.

## Environment variables

The public marketplace runs with only `NODE_ENV=production`. The existing Control Center authentication was designed for the Manus-hosted preview and is intentionally hidden when its OAuth configuration is absent.

To enable the current Manus OAuth integration outside the managed preview, Railway would require `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `JWT_SECRET`, `OWNER_OPEN_ID` and `DATABASE_URL`, plus an OAuth redirect URI matching the production domain. For a portable production launch, replacing it with a provider-independent authentication system is recommended before enabling staff access.

## Custom domain

After the Railway-generated domain is healthy, add `providerbeacon.com` in Railway's public networking settings. Railway provides the required CNAME and TXT records. Add both records in Namecheap Advanced DNS, wait for verification, and allow Railway to provision the TLS certificate automatically.

Do not remove the Railway-generated domain until the custom domain is verified and HTTPS works.
