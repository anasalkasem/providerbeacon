import { useState } from "react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { paymentText, paymentError } from "@/i18n/providerPayments";
import {
  BusinessCard,
  businessField,
  businessPrimary,
  businessSecondary,
} from "./BusinessUi";
import { PaymentStatusCard } from "./ProviderPayments";

type Output = inferRouterOutputs<AppRouter>["admin"]["business"]["payments"];
export function AdminPayments({ manage }: { manage: boolean }) {
  const { locale } = useLocale();
  const t = paymentText(locale);
  const [cursor, setCursor] = useState<string>();
  const settings = trpc.admin.business.payments.settings.useQuery(undefined, {
    enabled: manage,
    retry: false,
  });
  const history = trpc.admin.business.payments.list.useQuery(
    { cursor },
    { retry: false, refetchInterval: 30_000 }
  );
  return (
    <div className="space-y-6">
      {manage && (
        <>
          <h2 className="text-xl font-bold text-ink">{t.gates}</h2>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            {t.settingsHelp}
          </p>
          {settings.isError && (
            <p role="alert">{paymentError(settings.error.message, locale)}</p>
          )}
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {settings.data?.map(setting => (
              <GatewayForm
                key={`${setting.gateway}:${setting.revision}`}
                setting={setting}
              />
            ))}
          </div>
        </>
      )}
      <h2 className="text-xl font-bold text-ink">{t.history}</h2>
      {history.isError ? (
        <p role="alert">{paymentError(history.error.message, locale)}</p>
      ) : history.data?.items.length === 0 ? (
        <p className="text-sm text-slate-500">{t.noPayments}</p>
      ) : (
        <div className="space-y-4">
          {history.data?.items.map(payment => (
            <BusinessCard key={payment.id}>
              <h3 className="mb-3 font-bold" dir="auto">
                {payment.providerName ?? "—"}
              </h3>
              <PaymentStatusCard payment={payment} readOnly />
              {payment.transactionId && (
                <p className="mt-3 break-all text-xs text-slate-500">
                  <bdi>
                    {payment.gateway} · {payment.transactionId}
                  </bdi>
                </p>
              )}
              {payment.reviewReason && (
                <p className="mt-2 text-xs text-amber-800">
                  <bdi>{payment.reviewReason}</bdi>
                </p>
              )}
              {manage && payment.state === "review" && (
                <ApplyPayment
                  paymentId={payment.id}
                  verified={Boolean(payment.verifiedAt)}
                />
              )}
            </BusinessCard>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        {cursor && (
          <button
            className={businessSecondary}
            onClick={() => setCursor(undefined)}
          >
            {t.back}
          </button>
        )}
        {history.data?.nextCursor && (
          <button
            className={businessSecondary}
            onClick={() => setCursor(history.data!.nextCursor!)}
          >
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
function GatewayForm({ setting }: { setting: Output["settings"][number] }) {
  const { locale } = useLocale();
  const t = paymentText(locale);
  const utils = trpc.useUtils();
  const [environment, setEnvironment] = useState(setting.environment);
  const [enabled, setEnabled] = useState(setting.enabled);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const save = trpc.admin.business.payments.saveSettings.useMutation({
    onSuccess: async () => {
      setSecrets({});
      toast.success(t.saved);
      await utils.admin.business.payments.settings.invalidate();
      await utils.business.payments.methods.invalidate();
    },
  });
  const fields =
    setting.gateway === "paypal"
      ? [
          ["clientId", "Client ID"],
          ["clientSecret", "Client Secret"],
          ["merchantId", "Merchant ID"],
          ["webhookId", "Webhook ID"],
        ]
      : [
          ["apiKey", "API Key"],
          ["ipnSecret", "IPN Secret"],
        ];
  return (
    <BusinessCard>
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="text-lg font-extrabold text-ink">
          {setting.gateway === "paypal" ? "PayPal" : "NOWPayments"}
        </h3>
        <span className="text-xs text-slate-500">
          {setting.configured ? t.configured : t.missing}
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {setting.gateway === "paypal" ? t.paypalSetup : t.nowSetup}
      </p>
      <form
        className="mt-5 space-y-4"
        onSubmit={e => {
          e.preventDefault();
          save.mutate({
            gateway: setting.gateway,
            revision: setting.revision,
            enabled,
            environment,
            ...secrets,
          });
        }}
      >
        <fieldset disabled={save.isPending} className="space-y-4">
          {setting.gateway === "paypal" && (
            <label className="block text-sm font-semibold">
              {t.environment}
              <select
                className={businessField}
                value={environment}
                onChange={e => {
                  setEnvironment(e.target.value as typeof environment);
                  setSecrets({});
                  setEnabled(false);
                }}
              >
                <option value="live">{t.live}</option>
                <option value="sandbox">{t.sandbox}</option>
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([key, label]) => (
              <label className="block text-sm font-semibold" key={key}>
                <bdi>{label}</bdi>
                <input
                  className={businessField}
                  dir="ltr"
                  type={
                    key.toLowerCase().includes("secret") || key === "apiKey"
                      ? "password"
                      : "text"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={500}
                  required={
                    !setting.configured || environment !== setting.environment
                  }
                  value={secrets[key] ?? ""}
                  placeholder={
                    setting.configured && environment === setting.environment
                      ? "••••••••"
                      : ""
                  }
                  onChange={e =>
                    setSecrets({ ...secrets, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <label className="block text-sm font-semibold">
            {t.webhook}
            <input
              className={`${businessField} text-xs`}
              dir="ltr"
              readOnly
              value={setting.webhookUrl}
              onFocus={e => e.currentTarget.select()}
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            {t.enabled}
          </label>
          {environment === "sandbox" && (
            <p className="text-sm text-amber-800">{t.sandbox}</p>
          )}
          <button className={businessPrimary} type="submit">
            {t.save}
          </button>
        </fieldset>
        {save.error && (
          <p role="alert" className="text-sm text-red-700">
            {paymentError(save.error.message, locale)}
          </p>
        )}
      </form>
    </BusinessCard>
  );
}
function ApplyPayment({
  paymentId,
  verified,
}: {
  paymentId: string;
  verified: boolean;
}) {
  const { locale } = useLocale();
  const t = paymentText(locale);
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const apply = trpc.admin.business.payments.applyReviewed.useMutation({
    onSuccess: async () => {
      setNote("");
      await utils.admin.business.invalidate();
    },
  });
  const close = trpc.admin.business.payments.closeReview.useMutation({
    onSuccess: async () => {
      setNote("");
      await utils.admin.business.invalidate();
    },
  });
  return (
    <form
      className="mt-4 space-y-3 border-t border-slate-100 pt-4"
      onSubmit={e => {
        e.preventDefault();
        if (verified) apply.mutate({ paymentId, note });
      }}
    >
      {verified && (
        <p className="text-sm leading-7 text-slate-600">{t.applyHelp}</p>
      )}
      <p className="text-sm leading-7 text-slate-600">{t.closeHelp}</p>
      <label className="block text-sm font-semibold">
        {t.note}
        <input
          className={businessField}
          minLength={8}
          maxLength={600}
          required
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        {verified && (
          <button
            className={businessPrimary}
            disabled={apply.isPending || close.isPending}
          >
            {t.apply}
          </button>
        )}
        <button
          type="button"
          className={businessSecondary}
          disabled={
            apply.isPending || close.isPending || note.trim().length < 8
          }
          onClick={() => close.mutate({ paymentId, note })}
        >
          {t.closeReview}
        </button>
      </div>
      {apply.data?.state === "review" && (
        <p role="status" className="text-sm text-amber-800">
          {t.suspended}
        </p>
      )}
      {apply.error && (
        <p role="alert" className="text-sm text-red-700">
          {paymentError(apply.error.message, locale)}
        </p>
      )}
      {close.error && (
        <p role="alert" className="text-sm text-red-700">
          {paymentError(close.error.message, locale)}
        </p>
      )}
    </form>
  );
}
