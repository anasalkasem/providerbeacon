import ProviderPicker from "./ProviderPicker";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { sourcedOffer } from "../../../shared/sourcedOffers";
import { Button } from "./ui/button";

export default function SourcedOfferImport() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const allowed = !!access.data?.permissions.includes("providers.read");
  const [providerId, setProviderId] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [raw, setRaw] = useState("");
  const [reason, setReason] = useState("");
  const createProvider = trpc.admin.providers.createDraft.useMutation();
  const importer = trpc.admin.services.createSourcedDrafts.useMutation();
  const busy = importer.isPending || createProvider.isPending;
  const field = "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
  if (!allowed || !access.data?.permissions.includes("services.write")) return null;
  return <details className="rounded-2xl border border-slate-200 bg-white p-5">
    <summary className="cursor-pointer font-bold">{ar ? "إضافة عروض من مصادر عامة" : "Add offers from public sources"}</summary>
    <p className="mt-3 text-sm leading-6 text-slate-500">{ar ? "استورد حتى ٢٠ عرض SMM أو باقة شهرية من موقع المزود الرسمي. تُحفظ كمسودات وتتطلب تأكيد السعر وفحص الأهلية والاعتماد قبل النشر." : "Import up to 20 SMM offers or monthly packages from the provider's official website. Drafts still require price confirmation, eligibility review and approval before publication."}</p>
    <form className="mt-4 space-y-4" onSubmit={async event => {
      event.preventDefault();
      try {
        const offers = sourcedOffer.array().min(1).max(20).parse(JSON.parse(raw));
        let id = Number(providerId);
        if (!id) {
          if (!access.data?.permissions.includes("providers.write")) throw new Error(ar ? "اختر مزودًا موجودًا" : "Select an existing provider");
          const provider = await createProvider.mutateAsync({ name, websiteUrl: website });
          id = provider.id; setProviderId(String(id)); await utils.admin.providers.list.invalidate();
        }
        const result = await importer.mutateAsync({ providerId: id, offers, reason });
        toast.success(ar ? `حُفظت ${result.created.length} مسودة؛ ${result.skipped.length} موجودة مسبقًا` : `${result.created.length} drafts saved; ${result.skipped.length} already exist`);
        setRaw("");
        await Promise.all([utils.admin.services.list.invalidate(), utils.admin.services.reviewSummary.invalidate(), utils.admin.overview.invalidate()]);
      } catch (error) { toast.error(error instanceof Error ? error.message : "Import failed"); }
    }}>
      <ProviderPicker value={providerId} onChange={setProviderId} emptyLabel={ar ? "مزود جديد" : "New provider"}/>
      {!providerId && access.data?.permissions.includes("providers.write") && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">{ar ? "اسم المزود الجديد" : "New provider name"}<input className={field} value={name} required minLength={2} maxLength={200} onChange={e => setName(e.target.value)}/></label><label className="text-sm font-semibold">{ar ? "الموقع الرسمي" : "Official website"}<input className={field} dir="ltr" type="url" value={website} required onChange={e => setWebsite(e.target.value)}/></label></div>}
      <label className="block text-sm font-semibold">{ar ? "بيانات العروض (JSON)" : "Offers (JSON)"}<textarea className={`${field} min-h-44 font-mono text-xs`} dir="ltr" value={raw} required maxLength={50000} onChange={e => setRaw(e.target.value)}/></label>
      <label className="block text-sm font-semibold">{ar ? "سبب إضافة هذه الدفعة" : "Batch rationale"}<input className={field} value={reason} required minLength={8} maxLength={1000} onChange={e => setReason(e.target.value)}/></label>
      <Button disabled={busy}>{ar ? "حفظ كمسودات للمراجعة" : "Save drafts for review"}</Button>
    </form>
  </details>;
}
