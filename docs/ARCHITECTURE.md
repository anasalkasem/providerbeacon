# ProviderBeacon Architecture

## Product boundary

ProviderBeacon is an independent discovery and comparison layer. It does not treat price as the only ranking factor and does not hide paid placement inside organic trust scores.

## Application surfaces

| Surface | Audience | Access |
|---|---|---|
| Public marketplace | Visitors and buyers | Public |
| Provider workspace | Verified provider teams | Authenticated provider membership |
| Beacon Control Center | Internal operations team | Authorized staff only |

## Data model

The implemented schema includes users, providers, services, team memberships, provider integrations, price snapshots, localized content and audit events. The public API reads from the database first and falls back to versioned seed data when no database is configured. All sensitive mutations are enforced server-side through tRPC procedures.

## Permission model

Roles are bundles of granular permissions. The current permission vocabulary includes:

- `providers.read`, `providers.write`, `providers.review`
- `services.read`, `services.write`
- `translations.read`, `translations.write`
- `team.read`, `team.write`
- `integrations.read`, `integrations.write`
- `audit.read`

The principle is least privilege: staff members receive only the permissions required for their assigned work.

## Localization

The client determines an initial locale from a saved preference, then the browser language, with English fallback. The server stores entity-level localized content with Draft, Machine Translated, Reviewed and Published states. Arabic uses a complete RTL layout across both the public site and Control Center.

## Integrations and AI

Provider integrations currently support a one-time manual SMM API service import. Credentials are held only in request memory; responses are normalized, upserted, and captured as price snapshots. The importer requires public HTTPS, rejects private/reserved network targets, disables redirects, caps imports, and writes an audit event.

On-demand provider analysis uses `gpt-5-mini` with a strict JSON schema. The model receives only stored operational data, returns an advisory risk assessment in the requested language, and cannot mutate provider state. Human review remains mandatory.

## Beacon Score

Beacon Score is explainable and versioned. Candidate inputs include price freshness, identity verification, order completion, retention, support response, complaint outcomes, profile completeness and data consistency. A score must always expose its contributing signals and observation timestamp.

## Trust controls

- Sponsored placement cannot modify the organic reliability score.
- Price records carry source and freshness metadata.
- Provider status changes create immutable audit events.
- Complaints have evidence, owner, decision and appeal state.
- High-impact administrative operations require explicit permissions.
