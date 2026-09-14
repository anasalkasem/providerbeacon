import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { pricingCopy } from "@/i18n/pricing";
import { priceUnits, type PriceUnit } from "../../../shared/pricing";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export default function SourcePricingEditor({
  items,
  disabled,
  onSaved,
}: {
  items: { id: number; revision: number }[];
  disabled?: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { locale, dir } = useLocale();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<PriceUnit | "revoke" | "">("");
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("");
  const [checked, setChecked] = useState(false);
  const save = trpc.admin.services.confirmSourcePricing.useMutation({
    onSuccess: async () => {
      setOpen(false);
      toast.success(ar ? "حُفظ أساس تسعير المصدر" : "Source pricing saved");
      await onSaved();
    },
    onError: error =>
      toast.error(
        error.message === "review_conflict"
          ? ar
            ? "تغيّرت البيانات. حدّث القائمة وأعد المراجعة."
            : "Data changed. Refresh and review again."
          : ar
            ? "تعذر الحفظ. اختر خدمات API بعملة مؤكدة وأكمل رابط الدليل والسبب."
            : "Select API services with a confirmed currency and complete the evidence and reason."
      ),
  });
  const title = ar ? "وحدة تسعير API" : "API pricing unit";
  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !items.length}
        onClick={() => {
          setUnit("");
          setChecked(false);
          setEvidence("");
          setReason("");
          setScope("");
          setOpen(true);
        }}
      >
        {title}
      </Button>
      <Dialog
        open={open}
        onOpenChange={value => {
          if (!save.isPending) setOpen(value);
        }}
      >
        <DialogContent dir={dir} closeLabel={ar ? "إغلاق" : "Close"}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {ar
              ? `تطبيق على ${items.length} خدمة محددة. تأكيد الوحدة يتيح حساب التكلفة ولا يعتمد جودة الخدمة.`
              : `Apply to ${items.length} selected services. Confirming the unit enables cost calculation; it does not verify service quality.`}
          </DialogDescription>
          <form
            className="grid gap-4"
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              if (!unit || !checked) return;
              save.mutate({
                items,
                unit: unit === "revoke" ? null : unit,
                evidenceUrl: unit === "revoke" ? null : evidence.trim(),
                packageDescription: unit === "package" ? scope.trim() : null,
                reason,
                confirmed: true,
              });
            }}
          >
            <label className="grid gap-1 text-sm font-semibold">
              {ar
                ? "وحدة السعر الأصلي لدى المزود"
                : "Original provider rate unit"}
              <select
                className={field}
                required
                value={unit}
                disabled={save.isPending}
                onChange={e => {
                  setUnit(e.target.value as typeof unit);
                  setChecked(false);
                }}
              >
                <option value="">
                  {ar
                    ? "اختر بعد التحقق من المصدر"
                    : "Choose after checking the source"}
                </option>
                {priceUnits.map(u => (
                  <option key={u} value={u}>
                    {pricingCopy[locale]?.[u] ?? pricingCopy.en[u]}
                  </option>
                ))}
                <option value="revoke">
                  {ar ? "إلغاء تأكيد الوحدة" : "Revoke unit confirmation"}
                </option>
              </select>
            </label>
            {unit !== "revoke" && (
              <label className="grid gap-1 text-sm font-semibold">
                {ar ? "رابط دليل التسعير" : "Pricing evidence URL"}
                <input
                  className={field}
                  dir="ltr"
                  type="url"
                  required
                  maxLength={500}
                  value={evidence}
                  disabled={save.isPending}
                  onChange={e => setEvidence(e.target.value)}
                  placeholder="https://provider.example/services"
                />
              </label>
            )}
            {unit === "package" && (
              <label className="grid gap-1 text-sm font-semibold">
                {ar ? "محتويات الباقة" : "Package contents"}
                <textarea
                  className={field}
                  required
                  minLength={8}
                  maxLength={300}
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                />
              </label>
            )}
            <label className="grid gap-1 text-sm font-semibold">
              {ar
                ? "سبب التغيير وما تم التحقق منه"
                : "Reason and what was checked"}
              <textarea
                className={field}
                required
                minLength={8}
                maxLength={1000}
                value={reason}
                disabled={save.isPending}
                onChange={e => setReason(e.target.value)}
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                required
                checked={checked}
                disabled={save.isPending}
                onChange={e => setChecked(e.target.checked)}
              />
              {ar
                ? "راجعت هذه العملية لكل الخدمات المحددة، بما فيها الاستثناءات والباقات."
                : "I checked this change for every selected service, including exceptions and packages."}
            </label>
            <Button
              type="submit"
              disabled={!unit || !checked || save.isPending}
            >
              {save.isPending
                ? ar
                  ? "جارٍ الحفظ…"
                  : "Saving…"
                : ar
                  ? "حفظ أساس التسعير"
                  : "Save pricing basis"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
