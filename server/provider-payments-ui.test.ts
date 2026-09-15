// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  locale: "ar",
  data: null as any,
  returned: null as any,
  checkout: vi.fn(),
  check: vi.fn(),
  cancel: vi.fn(),
  invalidate: vi.fn(),
  settings: [] as any[],
  save: vi.fn(),
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      business: {
        mine: { invalidate: state.invalidate },
        payments: {
          invalidate: state.invalidate,
          methods: { invalidate: state.invalidate },
        },
      },
      admin: {
        business: {
          invalidate: state.invalidate,
          payments: { settings: { invalidate: state.invalidate } },
        },
      },
    }),
    business: {
      payments: {
        list: { useQuery: () => ({ data: state.data }) },
        methods: { useQuery: () => ({ data: state.data?.methods }) },
        status: {
          useQuery: () => ({ data: state.returned, refetch: state.invalidate }),
        },
        checkout: { useMutation: () => ({ mutate: state.checkout }) },
        check: { useMutation: () => ({ mutate: state.check }) },
        cancel: { useMutation: () => ({ mutate: state.cancel }) },
      },
    },
    admin: {
      business: {
        payments: {
          settings: { useQuery: () => ({ data: state.settings }) },
          list: { useQuery: () => ({ data: { items: [] } }) },
          saveSettings: { useMutation: () => ({ mutate: state.save }) },
          applyReviewed: { useMutation: () => ({ mutate: vi.fn() }) },
          closeReview: { useMutation: () => ({ mutate: vi.fn() }) },
        },
      },
    },
  },
}));
import {
  ProviderCheckout,
  PaymentReturn,
} from "../client/src/components/ProviderPayments";
import { AdminPayments } from "../client/src/components/AdminPayments";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/account/provider");
  state.locale = "ar";
  state.returned = null;
  state.settings = [];
  state.data = {
    quote: { amountCents: 2900 },
    allowed: true,
    items: [],
    methods: [
      { gateway: "paypal", available: true },
      { gateway: "nowpayments", available: false },
    ],
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("shows the next period price and submits only the gateway and provider", async () => {
  await act(() =>
    root.render(
      React.createElement(ProviderCheckout, { accountId: 7, providerId: 4 })
    )
  );
  expect(container.textContent).toContain("$29.00 USD");
  const paypal = [...container.querySelectorAll("button")].find(b =>
    b.textContent?.includes("PayPal")
  )!;
  const crypto = [...container.querySelectorAll("button")].find(b =>
    b.textContent?.includes("عملات رقمية")
  )!;
  expect(paypal.disabled).toBe(false);
  expect(crypto.disabled).toBe(true);
  await act(() => paypal.click());
  expect(state.checkout).toHaveBeenCalledWith({
    providerId: 4,
    gateway: "paypal",
  });
});
it("blocks new charges while a prior payment is in review", async () => {
  state.data.items = [
    {
      id: "7995ad2f-4b76-4e8f-a948-afc5032ad11e",
      gateway: "paypal",
      state: "review",
      amountCents: 1900,
      expiresAt: new Date(Date.now() + 60000),
    },
  ];
  await act(() =>
    root.render(
      React.createElement(ProviderCheckout, { accountId: 7, providerId: 4 })
    )
  );
  expect(container.textContent).toContain("الدفعة تحتاج مراجعة فريقنا");
  expect(
    [...container.querySelectorAll("button")].find(b =>
      b.textContent?.includes("PayPal")
    )!.disabled
  ).toBe(true);
  expect(state.checkout).not.toHaveBeenCalled();
});
it("does not turn a return URL into payment success and requests verification once", async () => {
  const id = "7995ad2f-4b76-4e8f-a948-afc5032ad11e";
  window.history.replaceState(
    null,
    "",
    `/account/provider?payment=${id}&success=1`
  );
  state.returned = {
    id,
    gateway: "paypal",
    state: "pending",
    amountCents: 1900,
    expiresAt: new Date(Date.now() + 60000),
  };
  await act(() =>
    root.render(React.createElement(PaymentReturn, { accountId: 7 }))
  );
  expect(container.textContent).toContain("بانتظار تأكيد الدفع");
  expect(container.textContent).not.toContain("تم تأكيد الدفع وإضافة الشهر");
  expect(state.check).toHaveBeenCalledTimes(1);
  await act(() =>
    root.render(React.createElement(PaymentReturn, { accountId: 7 }))
  );
  expect(state.check).toHaveBeenCalledTimes(1);
});
it("renders protected setup fields empty with explicit live and sandbox labels", async () => {
  state.settings = [
    {
      gateway: "paypal",
      enabled: false,
      configured: true,
      revision: 1,
      environment: "live",
      webhookUrl: "https://providerbeacon.com/api/payments/paypal/webhook",
    },
    {
      gateway: "nowpayments",
      enabled: false,
      configured: false,
      revision: 0,
      environment: "live",
      webhookUrl: "https://providerbeacon.com/api/payments/nowpayments/webhook",
    },
  ];
  await act(() =>
    root.render(React.createElement(AdminPayments, { manage: true }))
  );
  expect(container.textContent).toContain("PayPal");
  expect(container.textContent).toContain("NOWPayments");
  expect(container.textContent).toContain("اختبار — مخفي عن العملاء");
  for (const input of container.querySelectorAll<HTMLInputElement>(
    'input[type="password"]'
  ))
    expect(input.value).toBe("");
  expect(
    [
      ...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ].every(input => !input.checked)
  ).toBe(true);
});
