import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthText } from "@/i18n/auth";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Setup() {
  const text = useAuthText();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const status = trpc.auth.bootstrapStatus.useQuery(undefined, { retry: false });
  const setup = trpc.auth.bootstrapOwner.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); navigate("/admin/security", { replace: true }); },
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("token")) window.history.replaceState({}, "", "/setup");
  }, []);

  return <PublicLayout><main className="container grid min-h-[76vh] place-items-center py-16"><section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/70"><div className="flex items-start gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck/></div><div><h1 className="text-3xl font-extrabold text-slate-950">{text("setup")}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{text("setupBody")}</p></div></div>{status.isLoading ? <Loader2 className="mx-auto my-12 size-6 animate-spin"/> : !status.data?.available ? <div className="mt-8 flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-800"><CheckCircle2/>{text("setupUnavailable")}</div> : <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); if (password !== confirmation) return; setup.mutate({ token, name, email, password }); }}><label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">{text("setupToken")}<Input dir="ltr" type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} required/></label><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("name")}<Input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required/></label><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("email")}<Input dir="ltr" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required/></label><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("password")}<Input dir="ltr" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required/></label><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("confirmPassword")}<Input dir="ltr" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" required/></label><p className="text-xs leading-5 text-slate-500 sm:col-span-2">{password && confirmation && password !== confirmation ? <span className="font-semibold text-red-600">{text("mismatch")}</span> : text("passwordRule")}</p>{setup.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{setup.error.message}</p>}<Button className="h-12 rounded-xl sm:col-span-2" disabled={setup.isPending || password !== confirmation}>{setup.isPending && <Loader2 className="size-4 animate-spin"/>}{text("createAccount")}</Button></form>}</section></main></PublicLayout>;
}
