import { assertStaffOrigin } from "./staffOrigin";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inviteTokenFromLocation,
  teamChangeInput,
  teamInviteInput,
} from "../shared/team";
import { renderEmail } from "./emailTemplates";
import { teamWords } from "../client/src/i18n/team";
afterEach(() => vi.unstubAllEnvs());
describe("staff invitations", () => {
  it("accepts existing staff hosts but rejects missing, forged and cross-site origins", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
    for (const origin of ["https://providerbeacon.com", "https://www.providerbeacon.com"])
      expect(() => assertStaffOrigin({ headers: { origin } })).not.toThrow();
    for (const origin of [undefined, "https://evil.example", "https://providerbeacon.com.evil.example", "http://providerbeacon.com"])
      expect(() => assertStaffOrigin({ headers: { origin, host: "providerbeacon.com" } })).toThrow();
    expect(() => assertStaffOrigin({ headers: { origin: "https://www.providerbeacon.com", "sec-fetch-site": "cross-site" } })).toThrow();
  });
  it("normalizes email and refuses ownership, extra privileges and unversioned changes", () => {
    expect(
      teamInviteInput.parse({ email: " A@example.com ", role: "auditor" }).email
    ).toBe("a@example.com");
    for (const patch of [
      { role: "owner" },
      { userId: 1 },
      { permissions: ["team.write"] },
    ])
      expect(
        teamInviteInput.safeParse({
          email: "a@example.com",
          role: "auditor",
          ...patch,
        }).success
      ).toBe(false);
    expect(teamChangeInput.safeParse({ id: 1 }).success).toBe(false);
  });
  it("supports existing query invitations and prioritizes new fragment links", () => {
    expect(inviteTokenFromLocation("?token=old", "")).toBe("old");
    expect(inviteTokenFromLocation("?lang=ar&token=old", "#token=new")).toBe(
      "new"
    );
    expect(inviteTokenFromLocation("?lang=ar", "")).toBe("");
  });
  it("renders branded localized invitation emails with safe links and no marketing unsubscribe", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
    for (const locale of ["ar", "en", "es", "hi", "zh"] as const) {
      const mail = renderEmail({
        kind: "staff_invite",
        locale,
        name: "<script>staff</script>",
        url: `https://providerbeacon.com/team/accept?lang=${locale}#token=local-test-token`,
      });
      expect(mail.html).toContain(`lang="${locale}"`);
      expect(mail.html).toContain('alt="ProviderBeacon"');
      expect(mail.html).not.toContain("<script>");
      expect(mail.text).toContain("#token=local-test-token");
      expect(mail.text).not.toContain("/unsubscribe");
      expect(new Set(Object.values(teamWords[locale].mail)).size).toBe(10);
    }
    expect(() =>
      renderEmail({
        kind: "staff_invite",
        locale: "ar",
        name: "",
        url: "https://evil.example/team/accept",
      })
    ).toThrow();
  });
});
