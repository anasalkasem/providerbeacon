import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MailCheck, Mail, Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmailText } from "@/i18n/email";
import { useMember } from "@/hooks/useMember";
import { useLocale, localeNames, type Locale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { priceAlertCopy } from "@/i18n/priceAlerts";
import type { MemberProfile } from "@shared/memberAuth";

export function EmailPreferences({ member }: { member: MemberProfile }) {
  const t = useEmailText(),
    me = useMember(),
    utils = trpc.useUtils();
  const { locale: siteLocale } = useLocale();
  const [language, setLanguage] = useState(member.locale as Locale),
    [subscribed, setSubscribed] = useState(member.marketingOptIn);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const preferences = trpc.member.emailPreferences.useMutation({
    onSuccess: async () => {
      setNotice(t.saved);
      await utils.member.me.invalidate();
    },
    onError: () => setError(t.requestError),
  });
  const verify = trpc.member.requestVerification.useMutation({
    onSuccess: () => setNotice(t.queued),
    onError: () => setError(t.requestError),
  });
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Mail className="size-5 text-blue-800" />
        {t.preferences}
      </h2>
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault();
          setError("");
          setNotice("");
          preferences.mutate({ locale: language, marketingOptIn: subscribed });
        }}
      >
        <label className="grid gap-2 text-sm font-semibold">
          {t.language}
          <select
            className="h-11 rounded-lg border border-slate-300 bg-white px-3"
            value={language}
            onChange={e => setLanguage(e.target.value as Locale)}
          >
            {Object.entries(localeNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-3 text-sm leading-7">
          <input
            type="checkbox"
            className="mt-2 size-4 shrink-0"
            checked={subscribed}
            onChange={e => setSubscribed(e.target.checked)}
          />
          {t.consent}
        </label>
        <Button disabled={preferences.isPending}>{t.save}</Button>
      </form>
      {!member.emailVerified && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <Button
            variant="outline"
            disabled={!me.data?.emailEnabled || verify.isPending}
            onClick={() => {
              setNotice("");
              setError("");
              verify.mutate();
            }}
          >
            {t.sendVerification}
          </Button>
          {!me.data?.emailEnabled && (
            <p className="text-xs text-slate-500">{t.unavailable}</p>
          )}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-beacon-50 p-3 text-sm text-beacon-900"
        >
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
export default function MemberEmailPage() {
  const [path] = useLocation(),
    t = useEmailText(),
    me = useMember(),
    utils = trpc.useUtils();
  const { locale } = useLocale();
  const mode =
    path === "/verify-email"
      ? "verify"
      : path === "/reset-password"
        ? "reset"
        : path === "/unsubscribe"
          ? "unsubscribe"
          : "forgot";
  const [token] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get("token") ||
      new URLSearchParams(window.location.search).get("token") ||
      ""
  );
  const [priceScope] = useState(
    () => path === "/unsubscribe" && token.startsWith("prices.")
  );
  const priceText = priceAlertCopy[locale];
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (token) {
      const url = new URL(window.location.href);
      url.hash = "";
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [token]);
  const success = async () => {
    setDone(true);
    setPassword("");
    setConfirm("");
    await utils.member.me.invalidate();
    await utils.workspace.invalidate();
  };
  const fail = () => setError(mode === "forgot" ? t.requestError : t.error);
  const forgot = trpc.member.forgotPassword.useMutation({
    onSuccess: success,
    onError: fail,
  });
  const verify = trpc.member.verifyEmail.useMutation({
    onSuccess: success,
    onError: fail,
  });
  const reset = trpc.member.resetPassword.useMutation({
    onSuccess: success,
    onError: fail,
  });
  const unsub = trpc.member.unsubscribe.useMutation({
    onSuccess: success,
    onError: fail,
  });
  const busy =
    forgot.isPending || verify.isPending || reset.isPending || unsub.isPending;
  const title =
    mode === "verify"
      ? t.verify
      : mode === "reset"
        ? t.reset
        : mode === "unsubscribe"
          ? priceScope
            ? priceText.unsubTitle
            : t.unsub
          : t.forgot;
  return (
    <PublicLayout showCatalogueNotice={false}>
      <div className="container py-14">
        <section className="mx-auto max-w-lg space-y-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="grid size-12 place-items-center rounded-2xl bg-beacon-50 text-beacon-700">
            <MailCheck />
          </div>
          <p className="text-sm font-semibold text-blue-800">ProviderBeacon</p>
          <h1 className="text-2xl font-extrabold text-slate-950">{title}</h1>
          {done ? (
            <p
              role="status"
              className="rounded-xl bg-beacon-50 p-4 leading-7 text-beacon-900"
            >
              {mode === "verify"
                ? t.verified
                : mode === "reset"
                  ? t.resetDone
                  : mode === "unsubscribe"
                    ? priceScope
                      ? priceText.unsubDone
                      : t.unsubDone
                    : t.generic}
            </p>
          ) : (
            <form
              className="space-y-5"
              onSubmit={e => {
                e.preventDefault();
                setError("");
                if (mode === "forgot") forgot.mutate({ email });
                else if (mode === "verify") verify.mutate({ token });
                else if (mode === "unsubscribe") unsub.mutate({ token });
                else if (password !== confirm) setError(t.mismatch);
                else reset.mutate({ token, newPassword: password });
              }}
            >
              {mode === "forgot" && (
                <label className="grid gap-2 text-sm font-semibold">
                  {t.email}
                  <Input
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    maxLength={320}
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </label>
              )}
              {mode === "reset" && (
                <>
                  {[
                    [t.password, password, setPassword],
                    [t.confirmPassword, confirm, setConfirm],
                  ].map(([label, value, set]) => (
                    <label
                      key={label as string}
                      className="grid gap-2 text-sm font-semibold"
                    >
                      {label as string}
                      <Input
                        type="password"
                        dir="ltr"
                        autoComplete="new-password"
                        minLength={15}
                        maxLength={128}
                        required
                        value={value as string}
                        onChange={e =>
                          (set as (s: string) => void)(e.target.value)
                        }
                      />
                    </label>
                  ))}
                </>
              )}
              {mode === "unsubscribe" && (
                <p className="text-sm leading-7 text-slate-600">
                  {priceScope ? priceText.unsubBody : t.unsubBody}
                </p>
              )}
              {mode !== "forgot" && !token && (
                <p role="alert" className="text-sm text-red-700">
                  {t.error}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm leading-6 text-red-700">
                  {error}
                </p>
              )}
              {mode === "forgot" && !me.data?.emailEnabled && (
                <p className="text-sm text-slate-500">{t.unavailable}</p>
              )}
              <Button
                className="h-12 w-full"
                disabled={
                  busy || (mode === "forgot" ? !me.data?.emailEnabled : !token)
                }
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "forgot"
                  ? t.request
                  : mode === "unsubscribe"
                    ? priceScope
                      ? priceText.unsubTitle
                      : t.unsub
                    : t.continue}
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-blue-800">
            <Link href={`/sign-in?lang=${locale}`} className="underline">
              {t.signIn}
            </Link>
            <Link href={`/account?lang=${locale}`} className="underline">
              {t.account}
            </Link>
            {(mode === "forgot" || mode === "reset") && (
              <Link
                href={`/recover-account?lang=${locale}`}
                className="underline"
              >
                {t.recovery}
              </Link>
            )}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
