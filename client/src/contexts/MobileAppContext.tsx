import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function mobilePlatform(userAgent: string, touchPoints = 0) {
  if (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && touchPoints > 1)
  )
    return "ios";
  return /Android/i.test(userAgent) ? "android" : "desktop";
}
type AppState = {
  installed: boolean;
  canInstall: boolean;
  installState: "idle" | "opening" | "accepted" | "error";
  platform: ReturnType<typeof mobilePlatform>;
  online: boolean;
  updateReady: boolean;
  install: () => Promise<void>;
  update: () => void;
  dismissUpdate: () => void;
};
const Context = createContext<AppState>({
  installed: false,
  canInstall: false,
  installState: "idle",
  platform: "desktop",
  online: true,
  updateReady: false,
  install: async () => {},
  update: () => {},
  dismissUpdate: () => {},
});
export const useMobileApp = () => useContext(Context);

export function MobileAppProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
  const [canInstall, setCanInstall] = useState(false);
  const [installState, setInstallState] =
    useState<AppState["installState"]>("idle");
  const [online, setOnline] = useState(navigator.onLine);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissedWorker, setDismissedWorker] = useState<ServiceWorker | null>(
    null
  );
  const prompt = useRef<InstallPrompt | null>(null);
  const reloadRequested = useRef(false);
  const platform = mobilePlatform(
    navigator.userAgent,
    navigator.maxTouchPoints
  );

  useEffect(() => {
    const mode = window.matchMedia("(display-mode: standalone)");
    const onMode = () =>
      setInstalled(
        mode.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true
      );
    const onPrompt = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
      setCanInstall(true);
      setInstallState("idle");
    };
    const onInstalled = () => {
      prompt.current = null;
      setCanInstall(false);
      setInstalled(true);
    };
    const onNetwork = () => setOnline(navigator.onLine);
    mode.addEventListener("change", onMode);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onNetwork);
    window.addEventListener("offline", onNetwork);
    return () => {
      mode.removeEventListener("change", onMode);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onNetwork);
      window.removeEventListener("offline", onNetwork);
    };
  }, []);

  useEffect(() => {
    if (
      !import.meta.env.PROD ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    )
      return;
    let stopped = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const reportWaiting = () => {
      if (
        !stopped &&
        registration?.waiting &&
        navigator.serviceWorker.controller
      )
        setWaiting(registration.waiting);
    };
    const onState = () => {
      if (installing?.state === "installed") reportWaiting();
    };
    const onUpdate = () => {
      installing?.removeEventListener("statechange", onState);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", onState);
    };
    const onController = () => {
      setWaiting(null);
      // A worker activated in another tab must never discard this tab's draft.
      if (reloadRequested.current) window.location.reload();
    };
    const checkUpdate = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void registration?.update().catch(() => {});
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    document.addEventListener("visibilitychange", checkUpdate);
    window.addEventListener("online", checkUpdate);
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(value => {
        if (stopped) return;
        registration = value;
        reportWaiting();
        registration.addEventListener("updatefound", onUpdate);
        onUpdate();
      })
      .catch(() => {
        /* Installation remains usable when browser storage is restricted. */
      });
    return () => {
      stopped = true;
      registration?.removeEventListener("updatefound", onUpdate);
      installing?.removeEventListener("statechange", onState);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onController
      );
      document.removeEventListener("visibilitychange", checkUpdate);
      window.removeEventListener("online", checkUpdate);
    };
  }, []);

  async function install() {
    const event = prompt.current;
    if (!event) return;
    prompt.current = null;
    setCanInstall(false);
    setInstallState("opening");
    try {
      await event.prompt();
      const result = await event.userChoice;
      setInstallState(result.outcome === "accepted" ? "accepted" : "idle");
    } catch {
      setInstallState("error");
    }
  }
  return (
    <Context.Provider
      value={{
        installed,
        canInstall: canInstall && !installed,
        installState,
        platform,
        online,
        updateReady: !!waiting && dismissedWorker !== waiting,
        install,
        update: () => {
          if (!waiting || waiting.state === "redundant") return;
          reloadRequested.current = true;
          waiting.postMessage({ type: "ACTIVATE_UPDATE" });
        },
        dismissUpdate: () => setDismissedWorker(waiting),
      }}
    >
      {children}
    </Context.Provider>
  );
}
