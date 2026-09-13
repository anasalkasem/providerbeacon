import { useAuth } from "@/_core/hooks/useAuth";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

export default function AcceptInvite() {
  const { locale } = useLocale(); const { user, loading } = useAuth();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const copy = locale === "ar" ? { title:"الانضمام إلى فريق ProviderBeacon", body:"سجّل الدخول بالحساب الذي تلقى الدعوة، ثم اقبل الدور المحدد.", signIn:"تسجيل الدخول للمتابعة", accept:"قبول الدعوة", invalid:"رابط الدعوة غير صالح.", done:"تم تفعيل وصولك إلى مركز التحكم.", open:"فتح مركز التحكم" } : { title:"Join the ProviderBeacon team", body:"Sign in with the account that received the invitation, then accept the assigned role.", signIn:"Sign in to continue", accept:"Accept invitation", invalid:"This invitation link is invalid.", done:"Your access to the control center is now active.", open:"Open control center" };
  const mutation = trpc.admin.acceptInvite.useMutation();
  return <PublicLayout><main className="container grid min-h-[70vh] place-items-center py-16"><section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">{mutation.isSuccess ? <CheckCircle2/> : <ShieldCheck/>}</div><h1 className="mt-5 text-3xl font-extrabold text-slate-950">{copy.title}</h1><p className="mt-3 leading-7 text-slate-500">{mutation.isSuccess ? copy.done : copy.body}</p>{!token ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{copy.invalid}</p> : loading ? <Loader2 className="mx-auto mt-7 size-6 animate-spin"/> : mutation.isSuccess ? <Button asChild className="mt-7 w-full rounded-xl"><Link href="/admin">{copy.open}</Link></Button> : !user ? <Button onClick={() => startLogin()} className="mt-7 w-full rounded-xl">{copy.signIn}</Button> : <Button onClick={() => mutation.mutate({ token })} disabled={mutation.isPending} className="mt-7 w-full rounded-xl">{mutation.isPending && <Loader2 className="size-4 animate-spin"/>}{copy.accept}</Button>}{mutation.isError && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{mutation.error.message}</p>}</section></main></PublicLayout>;
}
