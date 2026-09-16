import type { Request } from "express";
import { loginWithPassword } from "./authDb";
import { loginMember, reserveMemberRequests } from "./memberDb";
import {
  MemberAuthError,
  memberClientKey,
  memberEmailKey,
  withMemberPasswordWork,
} from "./memberSecurity";

// Share the existing member login budgets across both entry points.
export async function reservePasswordSignIn(req: Request, email: string) {
  await reserveMemberRequests([
    { key: `login:ip:${memberClientKey(req)}`, limit: 10, windowMs: 60000 },
    { key: "login:global", limit: 5000, windowMs: 3600000 },
    {
      key: `credential:email:${memberEmailKey(email)}`,
      limit: 10,
      windowMs: 900000,
    },
  ]);
}

export async function reserveStaffVerification(req: Request, subject: string) {
  await reserveMemberRequests([
    {
      key: `staff-proof:ip:${memberClientKey(req)}`,
      limit: 10,
      windowMs: 900000,
    },
    {
      key: `staff-proof:subject:${memberEmailKey(subject)}`,
      limit: 5,
      windowMs: 900000,
    },
  ]);
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  req: Request;
}) {
  // A valid member password never touches a same-email staff account or its
  // lockout counter. Neither an email match nor Google grants staff access.
  try {
    return {
      kind: "member" as const,
      ...(await loginMember(input.email, input.password)),
    };
  } catch (error) {
    if (
      !(error instanceof MemberAuthError) ||
      error.code !== "invalid_credentials"
    )
      throw error;
  }
  try {
    return {
      kind: "staff" as const,
      ...(await withMemberPasswordWork(() => loginWithPassword(input))),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (
        [
          "Email or password is incorrect",
          "Account access is suspended",
        ].includes(error.message)
      )
        throw new MemberAuthError("invalid_credentials");
      if (error.message === "Account temporarily locked. Try again later")
        throw new MemberAuthError("rate_limited");
    }
    throw error;
  }
}
