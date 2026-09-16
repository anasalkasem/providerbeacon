// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  role: "owner",
  grant: vi.fn(),
  revoke: vi.fn(),
  failure: false,
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "ar" }),
}));
vi.mock("@/lib/vipAnalytics", () => ({
  useVipImpression: () => undefined,
  trackVipEvent: vi.fn(),
}));
vi.mock("@/components/ProviderPicker", () => ({
  default: () => <div>Provider picker</div>,
}));
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: any) => children,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      admin: { business: { vip: { invalidate: vi.fn() } } },
      business: { vip: { invalidate: vi.fn() } },
    }),
    admin: {
      access: {
        useQuery: () => ({
          data: {
            role: state.role,
            permissions: ["business.read", "business.manage"],
          },
        }),
      },
      business: {
        account: { useQuery: () => ({}) },
        vip: {
          grant: {
            useMutation: () => ({
              mutate: state.grant,
              isPending: false,
              isError: state.failure,
              error: { message: "business_stale" },
            }),
          },
          revokeGrant: {
            useMutation: () => ({ mutate: state.revoke, isPending: false }),
          },
        },
      },
    },
  },
}));
import { VipGrantForm } from "../client/src/components/AdminVipGrants";
import { AdminBusinessPanel } from "../client/src/pages/AdminProviderBusiness";
import { VipCard } from "../client/src/components/VipCard";
let container: HTMLDivElement, root: Root;
const data = () =>
  ({
    provider: {
      id: 7,
      name: "Real provider",
      slug: "real",
      status: "active",
      logoUrl: "https://provider.example/logo.png",
      websiteUrl: "https://provider.example",
    },
    card: null,
    paidCardActive: false,
  }) as any;
const buttons = () => Array.from(container.querySelectorAll("button"));
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.role = "owner";
  state.grant.mockClear();
  state.revoke.mockClear();
  state.failure = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("complimentary VIP owner controls", () => {
  it("shows the free VIP entry only for the platform owner", async () => {
    await act(() => root.render(<AdminBusinessPanel />));
    expect(buttons().some(b => b.textContent === "VIP مجاني")).toBe(true);
    state.role = "administrator";
    await act(() => root.render(<AdminBusinessPanel />));
    expect(buttons().some(b => b.textContent === "VIP مجاني")).toBe(false);
  });
  it("requires review, shows the real logo and submits a bounded free grant with no payment fields", async () => {
    await act(() => root.render(<VipGrantForm data={data()} />));
    const activate = buttons().find(b => b.textContent === "تفعيل VIP مجانًا")!;
    expect(activate.disabled).toBe(true);
    expect(
      container.querySelector('img[src="https://provider.example/logo.png"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("ظهور برعاية المنصة");
    expect(container.textContent).not.toContain("ملكية موثّقة");
    await act(() =>
      (
        container.querySelector('input[type="checkbox"]') as HTMLInputElement
      ).click()
    );
    const select = container.querySelector("select")!;
    await act(() => {
      select.value = "7";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(() =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(state.grant).toHaveBeenCalledOnce();
    expect(state.grant.mock.calls[0][0]).toMatchObject({
      providerId: 7,
      revision: 0,
      durationDays: 7,
      contentConfirmed: true,
    });
    expect(Object.keys(state.grant.mock.calls[0][0]).sort()).toEqual([
      "contentConfirmed",
      "cover",
      "durationDays",
      "note",
      "providerId",
      "revision",
      "tagline",
    ]);
  });
  it("prevents replacing a current paid card even through form submission", async () => {
    await act(() =>
      root.render(<VipGrantForm data={{ ...data(), paidCardActive: true }} />)
    );
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
    expect(container.textContent).toContain("بطاقة باشتراك سارٍ");
    await act(() =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(state.grant).not.toHaveBeenCalled();
  });
  it("shows the expiry and requires an explicit second click to stop a grant", async () => {
    await act(() =>
      root.render(
        <VipGrantForm
          data={{
            ...data(),
            card: {
              providerId: 7,
              revision: 4,
              placement: "complimentary",
              status: "approved",
              tagline: "Explore this real provider",
              coverUrl: "",
              complimentaryEndsAt: new Date(Date.now() + 86400000),
            },
          }}
        />
      )
    );
    expect(container.textContent).toContain("نهاية VIP المجاني");
    expect(container.textContent).toContain("حفظ وتجديد VIP المجاني");
    const stop = buttons().find(b => b.textContent === "إيقاف VIP المجاني")!;
    await act(() => stop.click());
    expect(state.revoke).not.toHaveBeenCalled();
    await act(() => stop.click());
    expect(state.revoke).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 7, revision: 4 })
    );
  });
  it("keeps stale-save errors visible instead of reporting a successful grant", async () => {
    state.failure = true;
    await act(() => root.render(<VipGrantForm data={data()} />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "تغيّرت هذه البيانات"
    );
  });
  it("labels complimentary and paid visitor cards separately in compact and full layouts", async () => {
    const card = {
      providerId: 7,
      revision: 2,
      name: "Provider",
      slug: "provider",
      coverUrl: "",
      tagline: "Provider information",
      specialties: [],
      offer: "",
      offerEndsAt: null,
      ownershipVerified: false,
    };
    for (const compact of [true, false]) {
      await act(() =>
        root.render(
          <VipCard
            compact={compact}
            card={{ ...card, placement: "complimentary" }}
          />
        )
      );
      expect(container.textContent).toContain("ظهور برعاية المنصة");
      expect(container.textContent).not.toContain("ظهور مدفوع");
      await act(() =>
        root.render(
          <VipCard
            compact={compact}
            card={{ ...card, placement: "subscription" }}
          />
        )
      );
      expect(container.textContent).toContain("ظهور مدفوع");
    }
  });
});
