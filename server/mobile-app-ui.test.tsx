// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  MobileAppProvider,
  mobilePlatform,
  useMobileApp,
  type InstallPrompt,
} from "../client/src/contexts/MobileAppContext";
import {
  MobileNavigation,
  MobileAppStatus,
} from "../client/src/components/MobileApp";

const route = vi.hoisted(() => ({ path: "/find" }));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "ar", dir: "rtl" }),
}));
vi.mock("wouter", () => ({
  useLocation: () => [route.path],
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
let host: HTMLDivElement, root: Root;
let app: ReturnType<typeof useMobileApp>;
function Probe() {
  app = useMobileApp();
  return <MobileAppStatus />;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubEnv("PROD", false);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  route.path = "/find";
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function mount() {
  await act(async () =>
    root.render(
      <MobileAppProvider>
        <Probe />
        <MobileNavigation />
      </MobileAppProvider>
    )
  );
}
function installEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as InstallPrompt;
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome });
  return event;
}
describe("mobile app controls", () => {
  it("labels all five destinations and distinguishes saved services from account settings", async () => {
    await mount();
    expect(host.querySelectorAll("nav a")).toHaveLength(5);
    expect(
      host.querySelector('[aria-current="page"]')?.getAttribute("href")
    ).toBe("/find");
    route.path = "/account";
    await mount();
    expect(host.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe(
      "المحفوظات"
    );
    route.path = "/account/settings";
    await mount();
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe(
      "حسابي"
    );
  });
  it("prompts only on request, consumes the prompt once and does not mistake acceptance for installation", async () => {
    await mount();
    const event = installEvent("accepted");
    await act(async () => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(event.prompt).not.toHaveBeenCalled();
    expect(app.canInstall).toBe(true);
    await act(async () => app.install());
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(app.installState).toBe("accepted");
    expect(app.installed).toBe(false);
    await act(async () => app.install());
    expect(event.prompt).toHaveBeenCalledOnce();
    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(app.installed).toBe(true);
    expect(app.canInstall).toBe(false);
  });
  it("handles cancellation, a later prompt and prompt rejection", async () => {
    await mount();
    const dismissed = installEvent("dismissed");
    await act(async () => {
      window.dispatchEvent(dismissed);
    });
    await act(async () => app.install());
    expect(app.installState).toBe("idle");
    expect(app.installed).toBe(false);
    const failed = installEvent("accepted");
    failed.prompt = vi.fn(async () => {
      throw new Error("unavailable");
    });
    await act(async () => {
      window.dispatchEvent(failed);
    });
    await act(async () => app.install());
    expect(app.installState).toBe("error");
    expect(app.canInstall).toBe(false);
  });
  it("shows and clears the translated connectivity notice", async () => {
    await mount();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "أنت غير متصل"
    );
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(host.querySelector('[role="status"]')).toBeNull();
  });
  it("selects iPhone, desktop-mode iPad and Android installation guidance", () => {
    expect(mobilePlatform("Mozilla iPhone Safari")).toBe("ios");
    expect(mobilePlatform("Mozilla Macintosh Safari", 5)).toBe("ios");
    expect(mobilePlatform("Mozilla Macintosh Safari", 0)).toBe("desktop");
    expect(mobilePlatform("Mozilla Android Chrome")).toBe("android");
  });
  it("offers a waiting update without activation and only posts activation on user request", async () => {
    vi.stubEnv("PROD", true);
    vi.stubGlobal("isSecureContext", true);
    const waiting = { state: "installed", postMessage: vi.fn() };
    const registration = Object.assign(new EventTarget(), {
      waiting,
      installing: null,
      update: vi.fn(async () => {}),
    });
    const workers = Object.assign(new EventTarget(), {
      controller: {},
      register: vi.fn(async () => registration),
    });
    vi.stubGlobal("navigator", { onLine: true, userAgent: "Mozilla", maxTouchPoints: 0, serviceWorker: workers });
    await mount();
    expect(workers.register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    expect(app.updateReady).toBe(true);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    await act(async () => app.dismissUpdate());
    expect(app.updateReady).toBe(false);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    await act(async () => app.update());
    expect(waiting.postMessage).toHaveBeenCalledWith({
      type: "ACTIVATE_UPDATE",
    });
  });
});
