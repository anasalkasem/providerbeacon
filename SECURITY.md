# Security Policy

## Reporting a vulnerability

Do not open public issues for security vulnerabilities. Contact the project owner privately with the affected route, reproduction steps, impact and any supporting evidence.

## Security expectations

- Never commit credentials, `.env` files, access tokens or provider exports.
- Enforce authorization in backend procedures, not only in the interface.
- Validate all external input and uploaded-file metadata.
- Record sensitive administrative changes in the audit log.
- Apply least-privilege roles to team members and provider accounts.
- Keep dependency and deployment checks enabled before release.

This repository currently contains demonstration data only and must not be treated as a production data store.
