// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import PushControls from "../client/src/components/PushControls";
const state = vi.hoisted(() => ({
  data: {
    publicKey: "B".repeat(87),
    identity: "a".repeat(64),
    available: true,
    devices: [] as string[],
  },
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  test: vi.fn(),
  refetch: vi.fn(async () => ({})),
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "en" }),
}));
vi.mock("@/lib/trpc", () => {
  const api = {
    status: { useQuery: () => ({ data: state.data, refetch: state.refetch }) },
    subscribe: { useMutation: () => ({ mutateAsync: state.subscribe }) },
    unsubscribe: { useMutation: () => ({ mutateAsync: state.unsubscribe }) },
    test: { useMutation: () => ({ mutateAsync: state.test }) },
  };
  return { trpc: { messaging: { push: api, support: { push: api } } } };
});
let host: HTMLDivElement,
  root: Root,
  sub: any,
  current: any,
  registration: any,
  permission: any;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("PushManager", class {});
  permission = {
    permission: "default",
    requestPermission: vi.fn(async () => "granted"),
  };
  vi.stubGlobal("Notification", permission);
  vi.stubGlobal(
    "MessageChannel",
    class {
      port1: any = { close: vi.fn(), onmessage: null };
      port2 = {
        deliver: (value: any) => this.port1.onmessage?.({ data: value }),
      };
    }
  );
  current = null;
  sub = {
    endpoint: "https://web.push.apple.com/device",
    expirationTime: null,
    toJSON: () => ({ keys: { p256dh: "key", auth: "auth" } }),
    unsubscribe: vi.fn(async () => {
      current = null;
      return true;
    }),
  };
  registration = {
    active: {
      postMessage: vi.fn((_data, ports) => ports[0].deliver({ push: true })),
    },
    pushManager: {
      getSubscription: vi.fn(async () => current),
      subscribe: vi.fn(async () => {
        current = sub;
        return sub;
      }),
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });
  state.data.devices = [];
  state.refetch.mockClear();
  state.subscribe.mockReset().mockImplementation(async () => {
    state.data.devices = [
      Buffer.from(
        await webcrypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(sub.endpoint)
        )
      ).toString("hex"),
    ];
  });
  state.unsubscribe.mockReset().mockResolvedValue({ ok: true });
  state.test.mockReset().mockResolvedValue({ accepted: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete (navigator as any).serviceWorker;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function mount() {
  await act(async () => {
    root.render(<PushControls kind="staff" scope="staff:1" />);
  });
}
function button(text: string) {
  return Array.from(host.querySelectorAll("button")).find(b =>
    b.textContent?.includes(text)
  )!;
}
describe("phone notification controls", () => {
  it("requests permission only from a tap, registers the current identity, and offers a test only after registration", async () => {
    await mount();
    expect(permission.requestPermission).not.toHaveBeenCalled();
    expect(state.subscribe).not.toHaveBeenCalled();
    await act(async () => {
      button("Enable phone").click();
      expect(permission.requestPermission).toHaveBeenCalledOnce();
      await vi.waitFor(() => expect(state.refetch).toHaveBeenCalled());
    });
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
    expect(state.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ identity: "a".repeat(64), locale: "en" })
    );
    expect(button("Turn off").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("Test notification").click());
    expect(state.test).toHaveBeenCalledWith({
      endpoint: sub.endpoint,
      identity: "a".repeat(64),
    });
    expect(host.textContent).toContain("accepted for delivery");
  });
  it("honors permission denial without subscribing", async () => {
    permission.requestPermission.mockResolvedValue("denied");
    await mount();
    await act(async () => button("Enable phone").click());
    expect(state.subscribe).not.toHaveBeenCalled();
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Notifications are blocked");
  });
  it("revokes at the browser even when the server is unreachable", async () => {
    await mount();
    await act(async () => {
      button("Enable phone").click();
      await vi.waitFor(() => expect(state.refetch).toHaveBeenCalled());
    });
    state.unsubscribe.mockRejectedValue(new Error("offline"));
    await act(async () => button("Turn off").click());
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
    expect(button("Enable phone").getAttribute("aria-pressed")).toBe("false");
  });
  it("removes a newly created subscription if saving it fails", async () => {
    state.subscribe.mockRejectedValue(new Error("identity changed"));
    await mount();
    await act(async () => button("Enable phone").click());
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
    expect(button("Enable phone").getAttribute("aria-pressed")).toBe("false");
  });
});
