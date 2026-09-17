import { BellRing, Users, Volume2, VolumeX } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { messagingCopy } from "@/i18n/messaging";
import type { useMessageAlerts } from "@/hooks/useMessageAlerts";

export function UnreadMessages({ count }: { count: number }) {
  const { locale } = useLocale();
  if (!count) return null;
  return (
    <span
      role="status"
      aria-label={`${messagingCopy[locale].unreadMessages}: ${count}`}
      className="inline-flex min-w-6 items-center justify-center rounded-full bg-beacon-300 px-2 py-0.5 text-xs font-bold tabular-nums text-ink"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function WaitingCustomers({ count }: { count: number }) {
  const { locale } = useLocale();
  if (!count) return null;
  const label = `${messagingCopy[locale].queue}: ${count}`;
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-900"
    >
      <Users className="size-3" aria-hidden="true" />
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function MessageAlertControls({
  alerts,
}: {
  alerts: ReturnType<typeof useMessageAlerts>;
}) {
  const { locale } = useLocale(),
    t = messagingCopy[locale];
  const audible = alerts.enabled && alerts.ready;
  return (
    <div className="shrink-0 border-b border-slate-200 bg-[#f4f6ef] px-4 py-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <BellRing className="size-4 text-beacon-800" aria-hidden="true" />
        <span className="me-auto font-semibold">{t.messageAlerts}</span>
        <button
          type="button"
          data-message-sound-control
          onClick={() => (audible ? alerts.mute() : void alerts.enableSound())}
          aria-pressed={audible}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#bdcca3] bg-white px-2.5 py-1.5 font-semibold text-[#344320] hover:bg-beacon-100"
        >
          {audible ? (
            <Volume2 className="size-4" aria-hidden="true" />
          ) : (
            <VolumeX className="size-4" aria-hidden="true" />
          )}
          {audible ? t.muteSound : t.enableSound}
        </button>
        {audible && (
          <button
            type="button"
            onClick={() => void alerts.test()}
            className="rounded-lg px-2 py-1.5 font-semibold underline underline-offset-2"
          >
            {t.testSound}
          </button>
        )}
      </div>
      <p
        className={`mt-1.5 text-[11px] leading-5 ${alerts.soundFailed ? "text-amber-800" : "text-slate-500"}`}
        role={alerts.soundFailed ? "alert" : undefined}
      >
        {alerts.soundFailed
          ? t.soundUnavailable
          : alerts.enabled && !alerts.ready
            ? t.soundActivation
            : t.alertScope}
      </p>
    </div>
  );
}
