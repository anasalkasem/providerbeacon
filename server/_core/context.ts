import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse } from "cookie";
import type { User } from "../../drizzle/schema";
import { authenticateStaffSession } from "../authDb";
import { STAFF_SESSION_COOKIE } from "../security";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  authMode?: "staff" | "oauth" | null;
  staffSessionToken?: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let authMode: "staff" | "oauth" | null = null;
  const cookies = parse(opts.req.headers.cookie ?? "");
  const staffSessionToken = cookies[STAFF_SESSION_COOKIE];

  if (staffSessionToken) {
    try {
      user = await authenticateStaffSession(staffSessionToken);
      if (user) authMode = "staff";
    } catch (error) {
      console.warn("[StaffAuth] Session authentication failed:", error);
    }
  }

  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
      if (user) authMode = "oauth";
    } catch {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    authMode,
    staffSessionToken,
  };
}
