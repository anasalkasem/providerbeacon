import { useAuth } from "@/_core/hooks/useAuth";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthText } from "@/i18n/auth";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function AcceptInvite() {
  const text = useAuthText();
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const accept = trpc.admin.acceptInvite.useMutation();
  const register = trpc.auth.registerInvite.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); navigate("/admin/security", { replace: true }); } });
  const invalid = !token;

  return <PublicLayout><main className="container grid min-h-[76vh] place-items-center py-16"><section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">{accept.isSuccess ? <CheckCircle2/> : <ShieldCheck/>}</div><h1 className="mt-5 text-center text-3xl font-extrabold text-slate-950">{text("invitedTitle")}</h1><p className="mt-3 text-center leading-7 text-slate-500">{text("invitedBody")}</p>
    {invalid ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">Invalid invitation link.</p> : loading ? <Loader2 className="mx-auto mt-7 size-6 animate-spin"/> : user ? accept.isSuccess ? <Button asChild className="mt-7 w-full rounded-xl"><Link href="/admin">Open control center</Link></Button> : <Button onClick={() => accept.mutate({ token })} disabled={accept.isPending} className="mt-7 w-full rounded-xl">{accept.isPending && <Loader2 className="size-4 animate-spin"/>}Accept invitation</Button> : <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); if (password === confirmation) register.mutate({ token, name, email, password }); }}><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("name")}<Input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required/></label><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("email")}<Input dir="ltr" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required/></label><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("password")}<Input dir="ltr" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required/></label><label className="grid gap-2 text-sm font-semibold text-slate-700">{text("confirmPassword")}<Input dir="ltr" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" required/></label><p className="text-xs text-slate-500 sm:col-span-2">{password && confirmation && password !== confirmation ? <span className="text-red-600">{text("mismatch")}</span> : text("passwordRule")}</p><Button className="h-12 rounded-xl sm:col-span-2" disabled={register.isPending || password !== confirmation}>{register.isPending && <Loader2 className="size-4 animate-spin"/>}{text("createInvited")}</Button></form>}
    {(accept.error || register.error) && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{accept.error?.message ?? register.error?.message}</p>}
  </section></main></PublicLayout>;
}
