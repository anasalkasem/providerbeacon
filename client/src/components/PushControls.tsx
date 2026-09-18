import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { pushCopy } from "../../../shared/push";

export function workerSupportsPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  if (!registration.active) return Promise.resolve(false);
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(ready);
    };
    const timer = setTimeout(() => finish(false), 1500);
    channel.port1.onmessage = event => finish(event.data?.push === true);
    registration.active!.postMessage({ type: "PUSH_CAPABILITY" }, [
      channel.port2,
    ]);
  });
}
export default function PushControls({
  kind,
  scope,
}: {
  kind: "staff" | "visitor";
  scope: string;
}) {
  const { locale } = useLocale();
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("PushManager" in window) ||
    !("serviceWorker" in navigator)
  )
    return (
      <p className="border-b border-border px-4 py-2 text-[11px] leading-5 text-muted-foreground">
        {pushCopy[locale].unsupported}
      </p>
    );
  return <DeviceControls key={scope} kind={kind} scope={scope} />;
}
function DeviceControls({
  kind,
  scope,
}: {
  kind: "staff" | "visitor";
  scope: string;
}) {
  const { locale } = useLocale(),
    t = pushCopy[locale];
  const api =
    kind === "staff" ? trpc.messaging.push : trpc.messaging.support.push;
  const status = api.status.useQuery(
    { scope },
    { staleTime: 10000, retry: false }
  );
  const subscribe = api.subscribe.useMutation(),
    unsubscribe = api.unsubscribe.useMutation(),
    test = api.test.useMutation();
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [deviceId, setDeviceId] = useState("");
  const [permission, setPermission] = useState(Notification.permission);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function readSubscription(reg: ServiceWorkerRegistration) {
    const sub = await reg.pushManager.getSubscription();
    const hash = sub
      ? Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(sub.endpoint)
            )
          )
        )
          .map(byte => byte.toString(16).padStart(2, "0"))
          .join("")
      : "";
    return { sub, hash };
  }
  useEffect(() => {
    let cancelled = false;
    void navigator.serviceWorker.ready
      .then(async reg => {
        const supported = await workerSupportsPush(reg),
          current = await readSubscription(reg);
        if (cancelled) return;
        setRegistration(reg);
        setReady(supported);
        setSubscription(current.sub);
        setDeviceId(current.hash);
      })
      .catch(() => {
        if (!cancelled) setNotice(t.error);
      });
    return () => {
      cancelled = true;
    };
  }, [t.error]);
  const enabled =
    permission === "granted" &&
    !!subscription &&
    !!status.data?.devices.includes(deviceId);
  async function enable() {
    if (!ready || !registration || !status.data?.publicKey || busy) return;
    // Permission must be requested directly from the tap, before any await.
    const request = Notification.requestPermission();
    setBusy(true);
    setNotice("");
    let created: PushSubscription | null = null;
    try {
      const granted = await request;
      setPermission(granted);
      if (granted !== "granted") {
        setNotice(t.blocked);
        return;
      }
      const raw = status.data.publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const key = Uint8Array.from(
        atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, "=")),
        c => c.charCodeAt(0)
      );
      const existing = await registration.pushManager.getSubscription();
      const sub =
        existing ??
        (created = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer,
        }));
      const json = sub.toJSON();
      await subscribe.mutateAsync({
        subscription: {
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        },
        locale,
        identity: status.data.identity,
      });
      const current = await readSubscription(registration);
      setSubscription(current.sub);
      setDeviceId(current.hash);
      await status.refetch();
    } catch {
      if (created) await created.unsubscribe().catch(() => {});
      setNotice(t.error);
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    if (!subscription || busy) return;
    setBusy(true);
    setNotice("");
    // Browser revocation still works when the server is unreachable.
    const results = await Promise.allSettled([
      unsubscribe.mutateAsync({
        endpoint: subscription.endpoint,
        identity: status.data!.identity,
      }),
      subscription.unsubscribe(),
    ]);
    if (
      results[0].status === "fulfilled" ||
      (results[1].status === "fulfilled" && results[1].value)
    ) {
      setSubscription(null);
      setDeviceId("");
      await status.refetch();
    } else setNotice(t.error);
    setBusy(false);
  }
  async function tryNotification() {
    if (!subscription || busy) return;
    setBusy(true);
    setNotice("");
    try {
      await test.mutateAsync({
        endpoint: subscription.endpoint,
        identity: status.data!.identity,
      });
      setNotice(t.sent);
    } catch {
      setNotice(t.error);
    } finally {
      setBusy(false);
    }
  }
  const explanation =
    notice ||
    (permission === "denied"
      ? t.blocked
      : status.isError || status.data?.available === false
        ? t.unavailable
        : !ready
          ? t.update
          : enabled
            ? t.on
            : t.off);
  return (
    <section
      className="shrink-0 border-b border-border bg-muted px-4 py-3 text-xs"
      aria-label={t.title}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="me-auto font-semibold">{t.title}</span>
        <button
          type="button"
          aria-pressed={enabled}
          disabled={
            busy ||
            (!enabled &&
              (!ready || !status.data?.available || permission === "denied"))
          }
          onClick={() => void (enabled ? disable() : enable())}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 font-semibold disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : enabled ? (
            <BellOff className="size-4" />
          ) : (
            <Bell className="size-4" />
          )}
          {enabled ? t.disable : t.enable}
        </button>
        {enabled && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void tryNotification()}
            className="min-h-10 px-2 font-semibold underline disabled:opacity-50"
          >
            {t.test}
          </button>
        )}
      </div>
      <p
        role="status"
        className="mt-1.5 text-[11px] leading-5 text-muted-foreground"
      >
        {explanation}
      </p>
    </section>
  );
}
