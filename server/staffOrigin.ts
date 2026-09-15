import { TRPCError } from "@trpc/server";
import { memberAuthOrigin } from "./memberSecurity";

// Existing staff sessions are host-only and may live on either production host.
// Keep this explicit allowlist; never trust a supplied Host/Forwarded header.
export function assertStaffOrigin(req: { headers: Record<string, unknown> }) {
  const canonical = memberAuthOrigin();
  const allowed = req.headers.origin === canonical ||
    (canonical === "https://providerbeacon.com" && req.headers.origin === "https://www.providerbeacon.com");
  if (!allowed || req.headers["sec-fetch-site"] === "cross-site")
    throw new TRPCError({ code: "FORBIDDEN", message: "staff_origin" });
}
