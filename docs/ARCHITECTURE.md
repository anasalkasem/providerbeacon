# ProviderBeacon Architecture

## Product boundary

ProviderBeacon is an independent discovery and comparison layer. It does not treat price as the only ranking factor and does not hide paid placement inside organic trust scores.

## Application surfaces

| Surface | Audience | Access |
|---|---|---|
| Public marketplace | Visitors and buyers | Public |
| Provider workspace | Verified provider teams | Authenticated provider membership |
| Beacon Control Center | Internal operations team | Authorized staff only |

## Target data model

The next database iteration will introduce providers, provider members, services, price observations, verification cases, reviews, complaints, score snapshots, roles, permissions, translations and audit events. All sensitive mutations must be enforced server-side through tRPC procedures.

## Permission model

Roles are bundles of granular permissions. Suggested permissions include:

- `provider.view`, `provider.edit`, `provider.verify`, `provider.suspend`
- `service.view`, `service.edit`, `service.approve`, `service.publish`
- `translation.edit`, `translation.review`, `translation.publish`
- `team.invite`, `team.change_role`
- `audit.view`, `finance.view`, `finance.export`

The principle is least privilege: staff members receive only the permissions required for their assigned work.

## Localization

The client determines an initial locale from a saved preference, then the browser language, with English fallback. The planned server model stores source strings and translation states: Missing, AI Generated, Draft, Human Reviewed, Published and Outdated. Arabic uses a complete RTL layout rather than text-only translation.

## Beacon Score

Beacon Score is explainable and versioned. Candidate inputs include price freshness, identity verification, order completion, retention, support response, complaint outcomes, profile completeness and data consistency. A score must always expose its contributing signals and observation timestamp.

## Trust controls

- Sponsored placement cannot modify the organic reliability score.
- Price records carry source and freshness metadata.
- Provider status changes create immutable audit events.
- Complaints have evidence, owner, decision and appeal state.
- High-impact administrative operations require explicit permissions.
