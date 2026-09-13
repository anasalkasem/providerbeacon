# ProviderBeacon Delivery Tracker

## Product goal

Build a production-ready aggregator for Social Media Marketing providers. Users must be able to discover SMM services, compare provider prices and trust signals, and make better purchasing decisions. Administrative access must follow least privilege.

## Current milestone: operational marketplace foundation

- [x] Public marketplace, provider directory, comparison UI and provider profiles
- [x] Multilingual shell with English, Spanish, Arabic, Hindi and Simplified Chinese
- [x] Responsive public UI and protected admin shell
- [x] GitHub repository and Railway production deployment
- [x] Railway health endpoint and deployment healthcheck
- [x] Persistent provider, service, team-role and audit-log schema
- [x] Public marketplace tRPC API with database-first and seed-data fallback
- [x] Granular role/permission enforcement for every admin operation
- [x] Functional provider and service management UI
- [x] Team access management and secure invitation workflow
- [x] Translation review workflow and locale quality controls
- [x] Provider API ingestion with manual refresh and price snapshots
- [x] On-demand AI provider risk explanations with human decision control
- [x] Production database provisioned, migrated, seeded and verified live
- [x] Custom-domain DNS and SSL activation for providerbeacon.com and www

## Security milestone: independent team access and encrypted integrations

- [x] Independent email/password authentication with scrypt password hashing
- [x] Host-only secure session cookies, expiry and server-side revocation
- [x] Failed-login lockout and timing-safe unknown-account handling
- [x] TOTP multi-factor authentication with one-time recovery codes
- [x] One-time owner bootstrap and invitation-based staff registration
- [x] AES-256-GCM provider credential vault with purpose-bound encryption
- [x] Granular integration permissions and complete audit logging
- [x] Admin UI for credential rotation, scheduling and manual synchronization
- [x] Hourly GitHub Actions schedule authenticated with short-lived OIDC
- [x] Production migration, deployment and end-to-end verification

## Role model

- **Owner:** unrestricted access, billing/security and role administration
- **Administrator:** all operational modules except ownership/billing
- **Operations Manager:** providers, catalogue, review queue and reports
- **Provider Reviewer:** verification, evidence and complaint decisions
- **Catalogue Editor:** service metadata, pricing and publishing
- **Translation Manager:** localized content and review status only
- **Auditor:** read-only reports and audit history

## Quality gates

- [x] No unauthenticated admin mutations
- [x] No client-only authorization for protected actions
- [x] Every mutation writes an audit entry
- [x] Public pages retain meaningful fallback content if the database is unavailable
- [x] TypeScript, unit tests and production build pass
- [x] Railway `/health` and homepage return HTTP 200 after deployment
