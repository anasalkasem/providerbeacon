import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_JWKS = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`));
const DEFAULT_AUDIENCE = "https://providerbeacon.com";
const DEFAULT_REPOSITORY = "anasalkasem/providerbeacon";

export function assertScheduledWorkflowClaims(payload: JWTPayload) {
  const repository = process.env.SCHEDULER_GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const audience = process.env.SCHEDULER_OIDC_AUDIENCE ?? DEFAULT_AUDIENCE;
  const eventName = String(payload.event_name ?? "");
  if (payload.aud !== audience) throw new Error("Unexpected OIDC audience");
  if (payload.repository !== repository) throw new Error("Unexpected GitHub repository");
  if (payload.ref !== "refs/heads/main") throw new Error("Scheduled synchronization must run from main");
  if (!['schedule', 'workflow_dispatch'].includes(eventName)) throw new Error("Unexpected workflow trigger");
  if (!payload.sub) throw new Error("Missing OIDC subject");
  return { repository, eventName, runId: String(payload.run_id ?? "") };
}

export async function verifyScheduledWorkflowToken(token: string) {
  const audience = process.env.SCHEDULER_OIDC_AUDIENCE ?? DEFAULT_AUDIENCE;
  const { payload } = await jwtVerify(token, GITHUB_JWKS, {
    issuer: GITHUB_ISSUER,
    audience,
    algorithms: ["RS256"],
  });
  return { payload, claims: assertScheduledWorkflowClaims(payload) };
}
