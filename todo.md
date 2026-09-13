# ProviderBeacon Delivery Tracker

## Product goal

Build a production-ready aggregator for Social Media Marketing providers. Users must be able to discover SMM services, compare provider prices and trust signals, and make better purchasing decisions. Administrative access must follow least privilege.

## Current milestone: operational marketplace foundation

- [x] Public marketplace, provider directory, comparison UI and provider profiles
- [x] Multilingual shell with English, Spanish, Arabic, Hindi and Simplified Chinese
- [x] Responsive public UI and protected admin shell
- [x] GitHub repository and Railway production deployment
- [x] Railway health endpoint and deployment healthcheck
- [ ] Persistent provider, service, team-role and audit-log schema
- [ ] Public marketplace tRPC API with database-first and seed-data fallback
- [ ] Granular role/permission enforcement for every admin operation
- [ ] Functional provider and service management UI
- [ ] Team access management and invitation workflow
- [ ] Translation review workflow and locale quality controls
- [ ] Provider API ingestion and price-refresh jobs
- [ ] AI-assisted search/ranking explanations
- [ ] Production database provisioned on Railway
- [ ] Custom domain DNS and SSL activation for providerbeacon.com

## Role model

- **Owner:** unrestricted access, billing/security and role administration
- **Administrator:** all operational modules except ownership/billing
- **Operations Manager:** providers, catalogue, review queue and reports
- **Provider Reviewer:** verification, evidence and complaint decisions
- **Catalogue Editor:** service metadata, pricing and publishing
- **Translation Manager:** localized content and review status only
- **Auditor:** read-only reports and audit history

## Quality gates

- [ ] No unauthenticated admin mutations
- [ ] No client-only authorization for protected actions
- [ ] Every mutation writes an audit entry
- [ ] Public pages retain meaningful fallback content if the database is unavailable
- [ ] TypeScript, unit tests and production build pass
- [ ] Railway `/health` and homepage return HTTP 200 after deployment
