# Visitor accounts and Google sign-in

Public pages: `/sign-in`, `/sign-up`, `/account`, `/recover-account`, `/privacy`.
The public `/sign-in` password form accepts member credentials and existing staff credentials. Staff sign-in continues to use its own session, roles, lockout and MFA; it never merges accounts by email. `/login` remains the dedicated staff entry, including when both account types have the same password. The public header recognizes active staff sessions and links to `/admin`.
Browsing, comparison and Beacon Assistant remain available without registration.

## Railway activation

The existing production `DATABASE_URL`, `AUTH_PEPPER`, `VAULT_MASTER_KEY` and migration setting are reused. Migration `0016_member_accounts` adds four visitor-only tables. It does not modify staff accounts, provider data or pricing.

Add these server variables to the **providerbeacon** service in Railway:

```dotenv
PUBLIC_APP_URL=https://providerbeacon.com
GOOGLE_CLIENT_ID=<your Google OAuth web client ID>
GOOGLE_CLIENT_SECRET=<your Google OAuth web client secret>
```

Do not prefix these names with `VITE_`. Never put the secret into chat, a screenshot, source code, browser storage or GitHub. The production origin defaults to `https://providerbeacon.com` when `PUBLIC_APP_URL` is absent. Email/password registration works without Google credentials; the Google button explicitly reports that it is unavailable until both are configured.

In Google Cloud / Google Auth Platform:

1. Configure app branding as **ProviderBeacon**, choose the actual support/developer email, and add authorized domain `providerbeacon.com`.
2. Set the home page to `https://providerbeacon.com` and privacy page to `https://providerbeacon.com/privacy`.
3. Create an OAuth client of type **Web application**.
4. Add the exact authorized redirect URI `https://providerbeacon.com/api/auth/google/callback`. An authorized JavaScript origin is not used by this server flow; if configuring one, use `https://providerbeacon.com`.
5. Request only `openid`, `email` and `profile`. For testing, add the actual test users. Complete Google's publishing/verification requirements for the chosen audience before offering Google sign-in to everyone.
6. Copy the client ID and secret directly into Railway, save/deploy, then perform a real Google sign-in and sign-out. A configured button alone does not establish that Google consent and credentials work.

Official references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [OAuth web server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [button branding](https://developers.google.com/identity/branding-guidelines).

## Identity and recovery behavior

- The shared password entry tries member authentication first; valid member credentials never affect staff lockout counters. Only an invalid member credential result falls through to staff password verification. Infrastructure errors fail closed. Both entry points share request budgets, and pending staff MFA continues at `/login?mfa=1` without resending the password.
- Staff can turn off their authenticator in `/admin/security` using an active, MFA-verified staff session, their current password, and a valid authenticator or recovery code. Confirmation clears the factor secrets and recovery codes, revokes other staff sessions, and writes an audit entry in one transaction. Passwords and member/Google accounts are unaffected. The authenticator can be enabled again with a fresh setup.

- Visitors use `member_accounts` and a separate `__Host-pb_member_session` HttpOnly, Secure, SameSite=Lax cookie. A visitor identity is never assigned to the staff `ctx.user`. Matching a staff email grants no administrative permissions.
- Passwords accept 15–128 characters, including Unicode passphrases, and are salted with scrypt. A missing account still incurs a password verification cost. Password work is capped at two concurrent jobs per process; shared MySQL limits apply by client, email hash and global action budget.
- Sessions last at most 30 days, with at most five sessions per account. Only token hashes are stored. Password changes and recovery revoke every old session. Security writes check the session again under the account row lock.
- Local email registration does **not** claim that the email is verified. There is no SMTP/email-reset integration in this release. Registration displays a high-entropy recovery code once, with an explicit save step. Recovery codes are hashed and single-use. Account recovery rotates the code, revokes sessions and removes Google linking; the recovery screen explains these effects.
- Google sign-in checks signature, issuer, audience, expiry, issuance time, nonce and verified email. The identity key is the hash of Google's stable, case-sensitive `sub`, never the email. A same-email local account must be signed in and explicitly linked; it is never automatically merged.
- OAuth uses state plus a browser-bound cookie, PKCE S256 and encrypted, single-use MySQL flow records expiring in ten minutes. The code exchange and JWKS endpoints are fixed HTTPS URLs with timeouts. Google access/refresh tokens are not stored.
- Linking a Google account requires the same email, proof of the existing account and the same still-active session at callback. Passwordless accounts require a Google session from the last ten minutes to add a password, generate recovery codes or delete the account.
- Public document routes on `www.providerbeacon.com` redirect to the apex domain so host-only cookies survive the Google callback. Staff routes, API requests and static assets are not redirected.
- Every visitor mutation requires the exact configured Origin, including anonymous registration/login. Member API responses are `no-store`; member mutations have a 32 KB request limit. Internal error details are not returned to visitors.
- Account deletion requires reauthentication and an explicit confirmation. It deletes only the visitor account and its sessions, leaving staff and Google accounts intact.

## Verification

Run `pnpm check`, `pnpm test`, `pnpm build`. The existing MySQL acceptance suite includes visitor cases, uses the existing serialized migrations, and refuses any database except local `providerbeacon_test`. It covers staff isolation, session rotation/caps, stale credentials, Google email collisions, explicit linking, revoked sessions, one-time recovery/state concurrency, shared rate limits and account deletion. Unit tests verify signed Google test tokens, anti-CSRF checks, cookie isolation, safe return paths, canonical routes and bounded token responses.

After deploying, verify the public pages in Arabic and Spanish, registration/password login/logout, an invalid Google callback, and the actual Google consent flow once credentials are configured. Never report the live Google flow as verified before completing it with a real authorized account.
