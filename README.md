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
- Server-enforced team roles, secure invitation links and immutable audit events.
- Database-backed provider and service publishing controls with safe seed fallback.
- Human-reviewed localization workflow for five supported locales.
- On-demand `gpt-5-mini` provider risk explanations that never change status automatically.
- AES-256-GCM provider credential vault with manual and scheduled SMM API imports.
- Independent staff authentication with scrypt password hashing, secure server sessions and TOTP MFA.
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
| Authentication | First-party email/password sessions with TOTP MFA; Manus OAuth retained as a migration fallback |
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
| `/admin/integrations` | Encrypted provider credential vault and sync schedules |
| `/admin/team` | Role and access management |
| `/admin/security` | Password, MFA and session controls |
| `/admin/translations` | Localization workflow |
| `/admin/audit` | Administrative audit log |
| `/login` | Independent staff sign-in and MFA verification |
| `/setup` | One-time initial owner setup |
| `/team/accept` | Invitation-based staff registration and acceptance |

## Security model

The public marketplace and protected administration area are intentionally separated. Every protected tRPC operation resolves the authenticated user's team membership and checks a granular permission on the server. Navigation visibility is only a usability aid, never authorization. Passwords are scrypt-hashed, opaque sessions are stored server-side, and TOTP MFA can be enabled per staff account. Provider/service changes, invitations, translation edits, AI analysis, credential rotation, scheduled imports and authenticated logout events write audit entries.

Provider API keys are encrypted with AES-256-GCM before persistence and never returned to the browser. The importer rejects private-network targets, disables redirects, caps responses at 5,000 records per run and records price history separately. The hourly schedule authenticates with a short-lived GitHub Actions OIDC token instead of a stored scheduler secret.

Never commit `.env` files, credentials, provider API keys or production exports.

## Product roadmap

The operational foundation includes a dedicated Railway MySQL database, automatic migrations and seed data, healthchecked deployments, custom-domain DNS, independent staff authentication, encrypted connector secrets and scheduled provider refreshes. The next launch stages are provider onboarding, real-data quality review and public beta operations.

## License

Copyright © 2026 ProviderBeacon. Source availability does not grant commercial reuse rights unless a license is added explicitly.
