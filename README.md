# ProviderBeacon

**ProviderBeacon** is a multilingual provider-intelligence platform for discovering and comparing Social Media Marketing services. It combines transparent price comparison with delivery, retention, refill protection, verification and an explainable **Beacon Score**.

> Find better providers. Choose with confidence.

## Current v0

The first product preview includes a production-quality public experience and a protected operations workspace:

- Responsive landing page with AI-assisted search entry.
- Searchable and filterable SMM service catalogue.
- Side-by-side service comparison.
- High-quality provider directory and provider profiles.
- Explainable provider trust scores.
- Browser-language detection with English, Spanish, Arabic, Hindi and Simplified Chinese UI foundations.
- Full RTL direction support for Arabic.
- Protected Beacon Control Center for authorized administrators.
- Team roles, translation status and audit-log interfaces.
- Lazy-loaded routes and accessible keyboard/focus behavior.

All provider names, prices and metrics in this version are demonstration data.

## Technology

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Design system | Tailwind CSS 4, shadcn/ui, Lucide |
| Routing | Wouter |
| API | Express and tRPC |
| Database | MySQL/TiDB with Drizzle ORM |
| Authentication | Manus OAuth |
| Testing | Vitest |

## Local development

```bash
pnpm install
pnpm dev
```

Run quality checks:

```bash
pnpm check
pnpm test
pnpm build
```

## Key routes

| Route | Purpose |
|---|---|
| `/` | Public landing and recommended matches |
| `/services` | Search, filter and select services |
| `/compare` | Side-by-side service comparison |
| `/providers` | Provider directory |
| `/providers/:slug` | Provider trust profile and catalogue |
| `/admin` | Protected operations overview |
| `/admin/providers` | Provider operations |
| `/admin/services` | Catalogue operations |
| `/admin/team` | Role and access management |
| `/admin/translations` | Localization workflow |
| `/admin/audit` | Administrative audit log |

## Security model

The public marketplace and protected administration area are intentionally separated. The Control Center requires an authenticated user with the `admin` role; hiding navigation alone is not treated as authorization. Production RBAC will extend this foundation with granular permissions such as `provider.verify`, `service.publish`, `translation.review` and `audit.view` at the API layer.

Never commit `.env` files, credentials, provider API keys or production exports.

## Product roadmap

The next implementation stages are real provider onboarding and database persistence, granular RBAC, data ingestion and freshness monitoring, explainable Beacon Score computation, AI natural-language search and translation review workflows.

## License

Copyright © 2026 ProviderBeacon. Source availability does not grant commercial reuse rights unless a license is added explicitly.
