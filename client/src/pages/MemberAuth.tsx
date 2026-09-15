import { metadataPrivacy } from "@/i18n/linkMetadata";
import { analyticsPrivacy } from "@/i18n/providerAnalytics";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/contexts/LocaleContext";
import { useMember } from "@/hooks/useMember";
import { useEmailText } from "@/i18n/email";
import { EmailPreferences } from "./MemberEmail";
import { memberErrorText, useMemberText } from "@/i18n/memberAuth";
import { trpc } from "@/lib/trpc";
import {
  memberPassword,
  memberRegistration,
  safeMemberNext,
  type MemberProfile,
} from "@shared/memberAuth";

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  const t = useMemberText();
  const [show, setShow] = useState(false);
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <span className="relative">
        <Input
          dir="ltr"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          maxLength={128}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-12 pe-12"
          required={required}
        />
        <button
          type="button"
          aria-label={show ? t.hide : t.show}
          onClick={() => setShow(!show)}
          className="absolute inset-y-0 end-0 grid w-12 place-items-center text-slate-500"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}
function GoogleButton({
  disabled,
  busy,
  onClick,
}: {
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const t = useMemberText();
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center gap-[10px] rounded-full border border-[#747775] bg-white px-3 py-3 text-sm font-medium text-[#1F1F1F] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ fontFamily: '"Google Sans", Arial, sans-serif' }}
    >
      <img
        src="https://developers.google.com/static/identity/images/g-logo.png"
        alt=""
        width="20"
        height="20"
        className="size-5 bg-white"
        referrerPolicy="no-referrer"
      />
      {busy && <Loader2 className="size-4 animate-spin" />}
      {t.google}
    </button>
  );
}
function AuthFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const t = useMemberText();
  return (
    <PublicLayout showCatalogueNotice={false}>
      <div className="container py-10 sm:py-16">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 lg:grid-cols-[.85fr_1fr]">
          <aside className="bg-[#071A35] p-7 text-white sm:p-10 lg:flex lg:flex-col lg:justify-center">
            <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300">
              <UserRound />
            </div>
            <p className="text-sm font-semibold tracking-wide text-cyan-300">
              ProviderBeacon
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-snug">
              {title}
            </h1>
            <p className="mt-4 leading-7 text-slate-300">{t.intro}</p>
            <p className="mt-6 text-sm leading-6 text-slate-400">{t.browse}</p>
          </aside>
          <section className="p-6 sm:p-10">{children}</section>
        </div>
      </div>
    </PublicLayout>
  );
}
function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700"
    >
      {message}
    </p>
  ) : null;
}
function RecoverySaved({
  code,
  onContinue,
}: {
  code: string;
  onContinue: () => void;
}) {
  const t = useMemberText();
  const [saved, setSaved] = useState(false),
    [copied, setCopied] = useState(false);
  return (
    <section className="space-y-5">
      <div className="grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-700">
        <KeyRound />
      </div>
      <h2 className="text-2xl font-bold">{t.recoveryTitle}</h2>
      <p className="text-sm leading-7 text-slate-600">{t.recoveryBody}</p>
      <code
        dir="ltr"
        className="block break-all rounded-xl border border-teal-200 bg-teal-50 p-4 text-center text-lg font-semibold text-teal-950 select-all"
      >
        {code}
      </code>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? t.copied : t.copy}
      </Button>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={saved}
          onChange={e => setSaved(e.target.checked)}
          className="size-4"
        />
        {t.savedCode}
      </label>
      <Button className="h-12 w-full" disabled={!saved} onClick={onContinue}>
        {t.continue}
        <ArrowRight className="size-4 rtl:rotate-180" />
      </Button>
    </section>
  );
}

export function MemberSignIn() {
  return <CredentialsPage mode="login" />;
}
export function MemberSignUp() {
  return <CredentialsPage mode="register" />;
}
function CredentialsPage({ mode }: { mode: "login" | "register" }) {
  const emailText = useEmailText();
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const t = useMemberText(),
    { locale } = useLocale();
  const [, navigate] = useLocation();
  const me = useMember(),
    utils = trpc.useUtils();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [recovery, setRecovery] = useState("");
  const [error, setError] = useState("");
  const params = new URLSearchParams(window.location.search);
  const next = safeMemberNext(params.get("next"));
  const onSuccess = async (data: {
    member: MemberProfile;
    recoveryCode?: string;
  }) => {
    setPassword("");
    setConfirm("");
    setError("");
    if (data.recoveryCode) setRecovery(data.recoveryCode);
    await utils.workspace.invalidate();
    await utils.member.me.invalidate();
    if (!data.recoveryCode) navigate(next, { replace: true });
  };
  const login = trpc.member.login.useMutation({
    onSuccess,
    onError: e => setError(memberErrorText(e, t)),
  });
  const register = trpc.member.register.useMutation({
    onSuccess,
    onError: e => setError(memberErrorText(e, t)),
  });
  const google = trpc.member.beginGoogle.useMutation({
    onSuccess: data => window.location.assign(data.authorizationUrl),
    onError: e => setError(memberErrorText(e, t)),
  });
  const busy = login.isPending || register.isPending || google.isPending;
  useEffect(() => {
    if (me.data?.member && !recovery && !busy)
      navigate(next, { replace: true });
  }, [me.data?.member, recovery, busy, next, navigate]);
  return (
    <AuthFrame title={mode === "login" ? t.welcome : t.join}>
      {recovery ? (
        <RecoverySaved
          code={recovery}
          onContinue={() => navigate(next, { replace: true })}
        />
      ) : (
        <div className="space-y-5">
          <h2 className="text-xl font-bold">
            {mode === "login" ? t.signIn : t.signUp}
          </h2>
          <GoogleButton
            disabled={!me.data?.googleEnabled || busy}
            busy={google.isPending}
            onClick={() => {
              setError("");
              google.mutate({ mode: "sign_in", next, locale });
            }}
          />
          {me.data && !me.data.googleEnabled && (
            <p className="text-xs leading-6 text-slate-500">{t.googleOff}</p>
          )}
          {me.isError && <ErrorMessage message={t.unavailable} />}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            {t.or}
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              setError("");
              if (mode === "register") {
                if (password !== confirm) {
                  setError(t.mismatch);
                  return;
                }
                const input = memberRegistration.safeParse({
                  name,
                  email,
                  password,
                  locale,
                  marketingOptIn,
                });
                if (!input.success) {
                  setError(t.invalid);
                  return;
                }
                register.mutate(input.data);
              } else login.mutate({ email, password });
            }}
          >
            {mode === "register" && (
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                {t.name}
                <Input
                  autoComplete="name"
                  className="h-12"
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </label>
            )}
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              {t.email}
              <Input
                dir="ltr"
                type="email"
                autoComplete="username"
                className="h-12"
                maxLength={320}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </label>
            <PasswordInput
              label={t.password}
              value={password}
              onChange={setPassword}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
            />
            {mode === "register" && (
              <>
                <p className="text-xs text-slate-500">{t.passwordHint}</p>
                <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2 size-4 shrink-0" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)}/>{emailText.consent}</label>
                <PasswordInput
                  label={t.confirmPassword}
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                />
              </>
            )}
            <ErrorMessage
              message={
                error ||
                (params.get("error")
                  ? memberErrorText(params.get("error"), t)
                  : "")
              }
            />
            <Button
              className="h-12 w-full rounded-xl bg-[#0B2A68] hover:bg-[#0E347F]"
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
              {mode === "login" ? t.signIn : t.signUp}
            </Button>
          </form>
          {mode === "login" && (
            <Link
              href={me.data?.emailEnabled ? "/forgot-password" : "/recover-account"}
              className="block text-center text-sm font-medium text-blue-800 hover:underline"
            >
              {me.data?.emailEnabled ? emailText.forgot : t.recover}
            </Link>
          )}
          <p className="text-center text-sm text-slate-500">
            {mode === "login" ? t.noAccount : t.haveAccount}{" "}
            <Link
              href={`${mode === "login" ? "/sign-up" : "/sign-in"}?next=${encodeURIComponent(next)}`}
              className="font-semibold text-blue-800 hover:underline"
            >
              {mode === "login" ? t.signUp : t.signIn}
            </Link>
          </p>
          <p className="border-t border-slate-100 pt-4 text-center text-xs leading-6 text-slate-500">
            {t.privacyHint}{" "}
            <Link href="/privacy" className="text-blue-800 underline">
              {t.privacy}
            </Link>
          </p>
        </div>
      )}
    </AuthFrame>
  );
}

export function MemberRecovery() {
  const t = useMemberText(),
    utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [recovery, setRecovery] = useState(""),
    [error, setError] = useState("");
  const recover = trpc.member.recover.useMutation({
    onSuccess: async data => {
      setRecovery(data.recoveryCode!);
      setPassword("");
      setConfirm("");
      setCode("");
      await utils.member.me.invalidate();
    },
    onError: e => setError(memberErrorText(e, t)),
  });
  return (
    <AuthFrame title={t.recover}>
      {recovery ? (
        <RecoverySaved
          code={recovery}
          onContinue={() => navigate("/account", { replace: true })}
        />
      ) : (
        <form
          className="space-y-5"
          onSubmit={e => {
            e.preventDefault();
            setError("");
            if (password !== confirm) {
              setError(t.mismatch);
              return;
            }
            recover.mutate({ email, code, newPassword: password });
          }}
        >
          <h2 className="text-xl font-bold">{t.recover}</h2>
          <p className="text-sm leading-7 text-slate-600">{t.recoveryIntro}</p>
          <label className="grid gap-2 text-sm font-semibold">
            {t.email}
            <Input
              type="email"
              dir="ltr"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              maxLength={320}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            {t.recoveryCode}
            <Input
              dir="ltr"
              autoComplete="off"
              value={code}
              onChange={e => setCode(e.target.value)}
              maxLength={100}
              required
            />
          </label>
          <PasswordInput
            label={t.newPassword}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <p className="text-xs text-slate-500">{t.passwordHint}</p>
          <PasswordInput
            label={t.confirmPassword}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          <ErrorMessage message={error} />
          <Button className="h-12 w-full" disabled={recover.isPending}>
            {recover.isPending && <Loader2 className="size-4 animate-spin" />}
            {t.recover}
          </Button>
          <Link
            href="/sign-in"
            className="block text-center text-sm text-blue-800"
          >
            {t.signIn}
          </Link>
        </form>
      )}
    </AuthFrame>
  );
}

export function MemberAccount() {
  const me = useMember(),
    t = useMemberText();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (me.data && !me.data.member)
      navigate("/sign-in?next=/account/settings", { replace: true });
  }, [me.data, navigate]);
  return (
    <PublicLayout showCatalogueNotice={false}>
      <div className="container min-h-[60vh] py-10 sm:py-16">
        {me.isError ? (
          <div className="mx-auto max-w-md space-y-4">
            <ErrorMessage message={t.unavailable} />
            <Button onClick={() => void me.refetch()}>{t.retry}</Button>
          </div>
        ) : me.data?.member ? (
          <AccountDetails
            member={me.data.member}
            googleEnabled={me.data.googleEnabled}
          />
        ) : (
          <p role="status" className="text-center text-slate-500">
            {t.loading}
          </p>
        )}
      </div>
    </PublicLayout>
  );
}
function AccountDetails({
  member,
  googleEnabled,
}: {
  member: MemberProfile;
  googleEnabled: boolean;
}) {
  const t = useMemberText(),
    { locale } = useLocale(),
    utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [name, setName] = useState(member.name),
    [currentPassword, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [recovery, setRecovery] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const onError = (e: unknown) => setError(memberErrorText(e, t));
  const refresh = () => utils.member.me.invalidate();
  const update = trpc.member.updateName.useMutation({
    onSuccess: async () => {
      setNotice(t.saved);
      await refresh();
    },
    onError,
  });
  const changed = async (data: { recoveryCode?: string }) => {
    setRecovery(data.recoveryCode!);
    setCurrent("");
    setPassword("");
    setConfirm("");
    await refresh();
  };
  const change = trpc.member.changePassword.useMutation({
    onSuccess: async data => {
      await changed(data);
      setNotice(t.passwordChanged);
    },
    onError,
  });
  const regenerate = trpc.member.recoveryCode.useMutation({
    onSuccess: changed,
    onError,
  });
  const leave = async () => {
    await utils.workspace.invalidate();
    utils.member.me.setData(undefined, old =>
      old ? { ...old, member: null } : undefined
    );
    navigate("/", { replace: true });
    await refresh();
  };
  const logout = trpc.member.logout.useMutation({ onSuccess: leave, onError });
  const remove = trpc.member.deleteAccount.useMutation({
    onSuccess: leave,
    onError,
  });
  const google = trpc.member.beginGoogle.useMutation({
    onSuccess: data => window.location.assign(data.authorizationUrl),
    onError,
  });
  const busy =
    update.isPending ||
    change.isPending ||
    regenerate.isPending ||
    logout.isPending ||
    remove.isPending ||
    google.isPending;
  const clear = () => {
    setError("");
    setNotice("");
  };
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <div className="grid size-14 place-items-center rounded-2xl bg-blue-100 text-blue-900">
          <UserRound />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">{t.account}</h1>
          <p className="mt-1 text-slate-500">{member.name}</p>
        </div>
      </div>
      {recovery ? (
        <div className="rounded-2xl border border-teal-200 bg-white p-6 sm:p-8">
          <RecoverySaved
            key={recovery}
            code={recovery}
            onContinue={() => setRecovery("")}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <ErrorMessage message={error} />
          {notice && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
            >
              <Check className="size-4" />
              {notice}
            </p>
          )}
          <form
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
            onSubmit={e => {
              e.preventDefault();
              clear();
              update.mutate({ name });
            }}
          >
            <h2 className="text-xl font-bold">{t.profile}</h2>
            <label className="grid gap-2 text-sm font-semibold">
              {t.name}
              <Input
                autoComplete="name"
                minLength={2}
                maxLength={120}
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </label>
            <div>
              <p className="text-sm font-semibold text-slate-700">{t.email}</p>
              <p dir="ltr" className="mt-2 break-all text-start">
                {member.email}
              </p>
              <span
                className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${member.emailVerified ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}
              >
                {member.emailVerified ? t.verified : t.unverified}
              </span>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                {t.emailNote}
              </p>
            </div>
            <Button disabled={busy}>
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              {t.save}
            </Button>
          </form>
          <EmailPreferences member={member} />
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold">{t.security}</h2>
            {member.hasPassword ? (
              <>
                <p className="text-sm text-slate-500">{t.proofHint}</p>
                <PasswordInput
                  label={t.currentPassword}
                  value={currentPassword}
                  onChange={setCurrent}
                  required={false}
                />
              </>
            ) : (
              <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                {t.googleProof}
              </p>
            )}
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <p className="font-semibold">
                {member.googleLinked ? t.googleLinked : t.googleUnlinked}
              </p>
              <p className="text-xs leading-6 text-slate-500">{t.linkHint}</p>
              {!member.googleLinked && (
                <p className="text-sm font-medium">{t.linkGoogle}</p>
              )}
              <GoogleButton
                disabled={!googleEnabled || busy}
                busy={google.isPending}
                onClick={() => {
                  clear();
                  google.mutate({
                    mode: member.googleLinked ? "sign_in" : "link",
                    locale,
                    next: "/account",
                    currentPassword,
                  });
                }}
              />
              {!googleEnabled && (
                <p className="text-xs text-slate-500">{t.googleOff}</p>
              )}
            </div>
            <form
              className="space-y-4 border-t border-slate-100 pt-5"
              onSubmit={e => {
                e.preventDefault();
                clear();
                if (password !== confirm) {
                  setError(t.mismatch);
                  return;
                }
                if (!memberPassword.safeParse(password).success) {
                  setError(t.invalid);
                  return;
                }
                change.mutate({ currentPassword, newPassword: password });
              }}
            >
              <PasswordInput
                label={t.newPassword}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-500">{t.passwordHint}</p>
              <PasswordInput
                label={t.confirmPassword}
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
              <Button disabled={busy}>
                {change.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t.changePassword}
              </Button>
            </form>
            <div className="border-t border-slate-100 pt-5">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  clear();
                  regenerate.mutate({ currentPassword });
                }}
              >
                {t.newRecovery}
              </Button>
            </div>
          </section>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                clear();
                logout.mutate({ all: false });
              }}
            >
              {t.logout}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                clear();
                logout.mutate({ all: true });
              }}
            >
              {t.logoutAll}
            </Button>
          </div>
          <div className="border-t border-slate-200 pt-6">
            <Button
              variant="ghost"
              className="text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={busy}
              onClick={() => {
                clear();
                if (window.confirm(t.deleteConfirm))
                  remove.mutate({ confirm: true, currentPassword });
              }}
            >
              {t.deleteAccount}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
export function MemberPrivacy() {
  const { locale } = useLocale();
  const emailText = useEmailText();
  const t = useMemberText();
  return (
    <PublicLayout showCatalogueNotice={false}>
      <article className="container py-12">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-7 sm:p-10">
          <h1 className="text-3xl font-extrabold">{t.privacyTitle}</h1>
          <p className="mt-3 text-xs text-slate-400">{t.privacyUpdated}</p>
          <div className="mt-8 space-y-6 leading-8 text-slate-600">
            {[
              t.privacyData,
              t.privacyGoogle,
              t.privacyCookies,
              analyticsPrivacy[locale],
              t.privacyAI,
              metadataPrivacy[locale],
              t.privacyDelete,
              emailText.privacy,
            ].map(p => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <Link
            href="/account"
            className="mt-8 inline-block font-semibold text-blue-800 underline"
          >
            {t.account}
          </Link>
        </div>
      </article>
    </PublicLayout>
  );
}
