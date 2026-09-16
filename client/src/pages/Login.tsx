import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicLayout } from "@/components/SiteChrome";
import { startOAuthLogin } from "@/const";
import { useAuthText } from "@/i18n/auth";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { safeStaffNext } from "@shared/signIn";

function safeNext() {
  return safeStaffNext(new URLSearchParams(window.location.search).get("next"));
}

export default function Login() {
  const text = useAuthText();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(() => new URLSearchParams(window.location.search).get("mfa") === "1");
  const oauthConfigured = Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);

  useEffect(() => {
    if (me.data) navigate(safeNext(), { replace: true });
  }, [me.data, navigate]);

  const login = trpc.auth.login.useMutation({
    onSuccess: async data => {
      if (data.mfaRequired) setMfaRequired(true);
      else { await utils.auth.me.invalidate(); navigate(safeNext(), { replace: true }); }
    },
  });
  const verify = trpc.auth.verifyMfa.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); navigate(safeNext(), { replace: true }); },
  });
  const error = login.error ?? verify.error;

  return <PublicLayout><main className="container grid min-h-[76vh] place-items-center py-16"><section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70"><div className="bg-ink p-7 text-white"><div className="grid size-12 place-items-center rounded-2xl bg-beacon-400/15 text-beacon-300">{mfaRequired ? <ShieldCheck/> : <LockKeyhole/>}</div><h1 className="mt-5 text-3xl font-extrabold">{text("signIn")}</h1><p className="mt-2 text-sm leading-6 text-slate-300">{mfaRequired ? text("mfaBody") : text("signInBody")}</p></div>
    {!mfaRequired ? <form className="space-y-4 p-7" onSubmit={event => { event.preventDefault(); login.mutate({ email, password }); }}><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("email")}<Input dir="ltr" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required/></label><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("password")}<Input dir="ltr" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label>{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}<Button className="h-12 w-full rounded-xl" disabled={login.isPending}>{login.isPending ? <Loader2 className="size-4 animate-spin"/> : <KeyRound className="size-4"/>}{text("continue")}</Button>{oauthConfigured && <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={() => startOAuthLogin()}>{text("oauthFallback")}</Button>}<Button variant="link" asChild className="w-full"><Link href="/">{text("backHome")}</Link></Button></form>
    : <form className="space-y-4 p-7" onSubmit={event => { event.preventDefault(); verify.mutate({ code }); }}><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("verificationCode")}<Input dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} placeholder="123456" required/></label>{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}<Button className="h-12 w-full rounded-xl" disabled={verify.isPending}>{verify.isPending && <Loader2 className="size-4 animate-spin"/>}{text("verify")}</Button></form>}
  </section></main></PublicLayout>;
}
