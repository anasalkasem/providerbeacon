import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  locale: "ar" as "ar" | "en" | "es" | "hi" | "zh",
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
import { TeamMemberActions } from "../client/src/components/TeamAccessTable";
import { teamWords } from "../client/src/i18n/team";
const base = {
  id: 2,
  userId: 2,
  email: "staff@example.com",
  role: "auditor",
  status: "active",
  revision: 1,
  invitationLocale: "ar",
};
function actions(patch = {}, canWrite = true, selfId = 1) {
  return renderToStaticMarkup(
    React.createElement(TeamMemberActions, {
      member: { ...base, ...patch },
      canWrite,
      selfId,
      busy: false,
      locale: state.locale,
      onEdit() {},
      onRemove() {},
      onResend() {},
      onStatus() {},
    })
  );
}
describe("employee management actions", () => {
  it("shows role editing and removal for active and suspended employees in all locales", () => {
    for (const locale of ["ar", "en", "es", "hi", "zh"] as const) {
      state.locale = locale;
      for (const status of ["active", "suspended"]) {
        const html = actions({ status });
        expect(html).toContain(teamWords[locale].edit);
        expect(html).toContain(teamWords[locale].remove);
        expect(html).not.toContain(teamWords[locale].resend);
      }
    }
  });
  it("exposes resend/edit/delete on pending invites and protects owner, self and read-only access", () => {
    state.locale = "ar";
    const html = actions({ status: "invited", userId: null });
    expect(html).toContain(teamWords.ar.resend);
    expect(html).toContain(teamWords.ar.cancelInvite);
    expect(html).toContain(teamWords.ar.edit);
    expect(actions({ role: "owner" })).not.toContain("<button");
    expect(actions({}, false)).not.toContain("<button");
    expect(actions({}, true, 2)).not.toContain("<button");
  });
});
