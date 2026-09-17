import { useState } from "react";
import { Link } from "wouter";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMember } from "@/hooks/useMember";
import { useLocale } from "@/contexts/LocaleContext";
import { workspaceCopy } from "@/i18n/workspace";
import { priceAlertCopy, priceAlertStatus } from "@/i18n/priceAlerts";
import { targetInput } from "../../../shared/buyerWorkspace";

export type PriceTargetProps = {
  id: number;
  target: string | null;
  currency?: string | null;
  current: string | null;
  canSetTarget: boolean;
  emailAlert: {
    enabled: boolean;
    status: string;
    revision: number;
    available?: boolean;
  };
};
export default function PriceTargetForm(props: PriceTargetProps) {
  const { locale } = useLocale(),
    t = priceAlertCopy[locale],
    w = workspaceCopy[locale];
  const me = useMember(),
    utils = trpc.useUtils();
  const [target, setTarget] = useState(props.target ?? "");
  const [email, setEmail] = useState(props.emailAlert.enabled);
  const verified = !!me.data?.member?.emailVerified;
  const save = trpc.workspace.target.useMutation({
    onSuccess: async () => {
      toast.success(w.targetSaved);
      await utils.workspace.invalidate();
    },
    onError: error =>
      toast.error(
        error.message === "price_alert_verification_required"
          ? t.verification
          : error.message === "price_alert_unavailable"
            ? t.unavailable
            : error.message === "price_alert_unconfirmed"
              ? t.unconfirmed
              : error.message === "price_alert_target_required"
                ? t.required
                : w.error
      ),
  });
  return (
    <section className="mt-5 border-t border-border pt-5">
      {props.emailAlert.enabled && (
        <div className="mb-4 rounded-xl bg-secondary p-3">
          <p
            role="status"
            className="flex items-start gap-2 text-xs font-semibold leading-6 text-foreground"
          >
            <Mail className="mt-1 size-4 shrink-0" />
            {priceAlertStatus(props.emailAlert.status, locale)}
          </p>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                id: props.id,
                target: props.target,
                emailAlert: false,
              })
            }
            className="mt-2 min-h-10 text-xs font-bold text-foreground underline disabled:opacity-50"
          >
            {t.stop}
          </button>
        </div>
      )}
      {props.canSetTarget && (
        <form
          onSubmit={e => {
            e.preventDefault();
            const parsed = targetInput.safeParse({
              id: props.id,
              target: target.trim() || null,
              emailAlert: email,
            });
            if (!parsed.success) return void toast.error(w.error);
            if (email && !parsed.data.target)
              return void toast.error(t.required);
            save.mutate(parsed.data);
          }}
        >
          <label
            className="block text-xs font-bold"
            htmlFor={`target-${props.id}`}
          >
            {w.target} ({props.currency})
          </label>
          <input
            id={`target-${props.id}`}
            inputMode="decimal"
            dir="ltr"
            type="text"
            maxLength={24}
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder={props.current ?? "0.00"}
            className="mt-2 h-11 w-full min-w-0 rounded-xl border border-border px-3 text-sm"
          />
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {w.targetHelp}
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-ring"
              checked={email}
              disabled={
                !email &&
                (!verified ||
                  !me.data?.emailEnabled ||
                  props.emailAlert.available === false)
              }
              onChange={e => setEmail(e.target.checked)}
            />
            <span>{t.consent}</span>
          </label>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">{t.help}</p>
          {!verified && (
            <p className="mt-2 text-xs leading-6 text-warning">
              {t.verification}{" "}
              <Link href="/account/settings" className="font-bold underline">
                {t.settings}
              </Link>
            </p>
          )}
          {(!me.data?.emailEnabled ||
            (verified && props.emailAlert.available === false)) && (
            <p className="mt-2 text-xs leading-6 text-warning">
              {t.unavailable}
            </p>
          )}
          <button
            disabled={save.isPending}
            className="mt-4 min-h-11 w-full rounded-xl bg-graphite px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {t.save}
          </button>
        </form>
      )}
    </section>
  );
}
