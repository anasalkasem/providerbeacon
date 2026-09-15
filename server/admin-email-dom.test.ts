// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en",
  permissions: ["emails.read", "emails.send"],
  status: {
    enabled: false,
    from: "ProviderBeacon <soporte@providerbeacon.com>",
    counts: [{ status: "queued", count: 1 }],
  },
  history: [] as any[],
  preview: {
    data: undefined as any,
    isPending: false,
    reset: vi.fn(),
    mutate: vi.fn(),
  },
  send: { isPending: false, reset: vi.fn(), mutate: vi.fn() },
}));
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("main", null, children),
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      admin: {
        email: {
          history: { invalidate: vi.fn() },
          status: { invalidate: vi.fn() },
        },
      },
    }),
    admin: {
      access: {
        useQuery: () => ({
          data: { permissions: state.permissions },
          isLoading: false,
        }),
      },
      email: {
        status: { useQuery: () => ({ data: state.status }) },
        history: { useQuery: () => ({ data: { items: state.history } }) },
        recipients: {
          useQuery: () => ({
            data: {
              items: [
                {
                  id: 1,
                  name: "Test customer",
                  email: "customer@example.com",
                  locale: "ar",
                  verified: true,
                  subscribed: true,
                },
              ],
            },
          }),
        },
        template: {
          useQuery: () => ({ data: { html: "<p>Template preview</p>" } }),
        },
        preview: { useMutation: () => state.preview },
        send: { useMutation: () => state.send },
      },
    },
  },
}));
import AdminEmail from "../client/src/pages/AdminEmail";

let container: HTMLDivElement, root: Root;
let errors: unknown[];
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  state.locale = "en";
  state.permissions = ["emails.read", "emails.send"];
  state.status = {
    enabled: false,
    from: "ProviderBeacon <soporte@providerbeacon.com>",
    counts: [{ status: "queued", count: 1 }],
  };
  state.history = [];
  state.preview.data = undefined;
  state.preview.reset.mockImplementation(() => {
    state.preview.data = undefined;
  });
  errors = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container, {
    onUncaughtError: error => errors.push(error),
  });
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(() => root.render(React.createElement(AdminEmail)));
}

// Model the browser translator replacing React-owned text nodes. Deliberately
// ignore translate="no" here to test structural resilience as a second defense.
function replaceTextNodes() {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (
      node.data.trim() &&
      !node.parentElement?.closest("option, textarea, script, style")
    )
      nodes.push(node);
  }
  for (const node of nodes) {
    const translated = document.createElement("font");
    translated.textContent = `ترجمة ${node.data}`;
    node.replaceWith(translated);
  }
}

describe("customer email DOM updates", () => {
  it("survives translation replacing text before email status arrives and during later refreshes", async () => {
    await render();
    replaceTextNodes();
    state.status = {
      ...state.status,
      enabled: true,
      counts: [
        { status: "delivered", count: 2 },
        { status: "queued", count: 3 },
      ],
    };
    await render();
    expect(errors).toEqual([]);
    expect(container.querySelector("h2")?.textContent).toBe(
      "Email sending enabled"
    );
    expect(container.querySelectorAll("strong")[1]?.textContent).toBe("3");
    replaceTextNodes();
    state.status = { ...state.status, enabled: false };
    state.locale = "ar";
    await render();
    expect(errors).toEqual([]);
    expect(container.querySelector("h1")?.textContent).toBe("بريد العملاء");
    expect(container.querySelector("h2")?.textContent).toBe(
      "الإرسال ينتظر التفعيل"
    );
  });

  it("refreshes translated history rows without leaving the old subject or status visible", async () => {
    state.history = [
      {
        id: 1,
        email: "customer@example.com",
        subject: "Welcome",
        status: "queued",
        locale: "en",
        createdAt: "2026-09-15T08:00:00Z",
      },
    ];
    await render();
    replaceTextNodes();
    state.history = [
      { ...state.history[0], subject: "Account update", status: "delivered" },
      { ...state.history[0], id: 2, subject: "Security update" },
    ];
    await render();
    expect(errors).toEqual([]);
    expect(container.querySelector("tbody")?.textContent).toContain(
      "Account update"
    );
    expect(container.querySelector("tbody")?.textContent).toContain(
      "Delivered to recipient server"
    );
    expect(container.querySelector("tbody")?.textContent).not.toContain(
      "Welcome"
    );
  });

  it("requires fresh approval after changing the email language", async () => {
    state.status.enabled = true;
    await render();
    await act(() =>
      container.querySelector<HTMLInputElement>('input[type="radio"]')!.click()
    );
    const preview = {
      from: state.status.from,
      recipient: { email: "customer@example.com" },
      html: "<p>Test preview</p>",
      proof: "test-proof",
    };
    state.preview.data = preview;
    await render();
    const sendButton = () =>
      Array.from(container.querySelectorAll("button")).find(b =>
        b.textContent?.includes("Confirm and queue email")
      )!;
    expect(sendButton().disabled).toBe(true);
    await act(() =>
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click()
    );
    expect(sendButton().disabled).toBe(false);
    const language = container.querySelector<HTMLSelectElement>("form select")!;
    await act(() => {
      language.value = "es";
      language.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    state.preview.data = preview;
    await render();
    expect(sendButton().disabled).toBe(true);
    expect(state.send.mutate).not.toHaveBeenCalled();
    await act(() =>
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click()
    );
    await act(() => sendButton().click());
    expect(state.send.mutate).toHaveBeenCalledTimes(1);
    expect(state.send.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        confirm: true,
        proof: "test-proof",
        message: expect.objectContaining({ memberId: 1, locale: "es" }),
      })
    );
  });
});
