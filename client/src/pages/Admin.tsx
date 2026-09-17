import CatalogueHealth from "@/components/CatalogueHealth";
import AdminAppearance from "@/components/AdminAppearance";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminText } from "@/i18n/admin";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, BadgeCheck, Database, ScrollText, ShieldCheck, Users } from "lucide-react";
import { Link } from "wouter";

export default function Admin() {
  const text = useAdminText();
  const access = trpc.admin.access.useQuery();
  const permissions = access.data?.permissions ?? [];
  const overview = trpc.admin.overview.useQuery(undefined, { enabled: Boolean(access.data?.role), staleTime: 30_000, retry: false });
  const auditQuery = trpc.admin.audit.list.useQuery({ limit: 5 }, { enabled: permissions.includes("audit.read"), retry: false });
  const cards = [
    { label: text("verifiedProviders"), value: overview.data?.verifiedProviders ?? "—", icon: BadgeCheck, href: "/admin/providers", action: text("manageProviders"), permission: "providers.read" },
    { label: text("publishedServices"), value: overview.data?.publishedServices ?? "—", icon: Database, href: "/admin/review?view=published", action: text("manageServices"), permission: "services.read" },
    { label: text("teamMembers"), value: overview.data?.teamMembers ?? "—", icon: Users, href: "/admin/team", action: text("manageTeam"), permission: "team.read" },
    { label: text("recordedActions"), value: overview.data?.recordedActions ?? "—", icon: ScrollText, href: "/admin/audit", action: text("reviewAudit"), permission: "audit.read" },
  ].filter(card => permissions.includes(card.permission as (typeof permissions)[number]));
  return <DashboardLayout><div className="mx-auto max-w-[1450px] p-2 sm:p-5"><div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-beacon-700">{text("controlCenter")}</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{text("operationsOverview")}</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">{text("overviewBody")}</p></div><Badge variant="outline" className="h-9 gap-2 rounded-xl border-emerald-200 bg-emerald-50 px-3 text-emerald-700"><span className="size-2 rounded-full bg-emerald-500"/>{overview.isError ? text("loadError") : text("controlCenter")}</Badge></div>{overview.isError && <p role="alert" className="mt-4 text-red-700">{text("loadError")} <button className="underline" onClick={() => void overview.refetch()}>{text("retry")}</button></p>}<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <article key={card.href} className="beacon-metric p-5"><div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-strong"><card.icon className="size-5"/></div><ShieldCheck className="size-4 text-emerald-500"/></div><p className="mt-5 text-3xl font-extrabold text-slate-950">{card.value}</p><p className="mt-1 text-sm font-semibold text-slate-600">{card.label}</p><Button variant="ghost" asChild className="mt-5 w-full justify-between rounded-xl"><Link href={card.href}>{card.action}<ArrowUpRight className="size-4 rtl:-scale-x-100"/></Link></Button></article>)}</div>{access.data?.role === "owner" && <AdminAppearance/>}{permissions.includes("services.read") && <div className="mt-8"><CatalogueHealth/></div>}{permissions.includes("audit.read") && <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="font-extrabold text-slate-950">{text("auditTitle")}</h2><p className="mt-1 text-xs text-slate-500">{text("auditSubtitle")}</p></div><Button variant="outline" asChild><Link href="/admin/audit">{text("reviewAudit")}</Link></Button></div><div className="divide-y divide-slate-100">{auditQuery.data?.map(entry => <div key={entry.id} className="grid gap-2 p-5 sm:grid-cols-[180px_1fr_auto] sm:items-center"><code dir="ltr" className="text-xs text-beacon-700">{entry.action}</code><p className="text-sm text-slate-600">{entry.summary}</p><time className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</time></div>)}</div></section>}</div></DashboardLayout>;
}
