import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";

export default function ProviderPicker({
  value,
  onChange,
  emptyLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = trpc.admin.providers.list.useQuery(
    { q, includeId: Number(value) || undefined, limit: 50 },
    { gcTime: 120_000, retry: false }
  );
  const field =
    "mt-2 w-full rounded-xl border border-border bg-card p-3 text-sm";
  const selected = query.data?.find(provider => String(provider.id) === value);
  return (
    <div className="space-y-2">
      {!disabled && (
        <label className="block text-sm font-semibold">
          {ar ? "البحث عن مزود" : "Search for a provider"}
          <input
            className={field}
            value={search}
            maxLength={100}
            onChange={e => setSearch(e.target.value)}
            placeholder={ar ? "اسم المزود" : "Provider name"}
          />
        </label>
      )}
      <label className="block text-sm font-semibold">
        {ar ? "المزود" : "Provider"}
        <select
          className={field}
          value={value}
          disabled={disabled}
          required
          onChange={e => onChange(e.target.value)}
        >
          <option value="">
            {emptyLabel ?? (ar ? "اختر مزودًا" : "Select a provider")}
          </option>
          {query.data?.map(provider => (
            <option key={provider.id} value={provider.id}>
              {provider.name} ·{" "}
              {provider.websiteUrl ?? (ar ? "الموقع غير محدد" : "No website")}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <div
          className="rounded-xl border border-input bg-secondary p-3 text-sm"
          role="status"
        >
          <strong className="block">{selected.name}</strong>
          <bdi
            dir="ltr"
            className="mt-1 block break-all text-xs text-muted-foreground"
          >
            {selected.websiteUrl ?? (ar ? "الموقع غير محدد" : "No website")}
          </bdi>
          <p className="mt-2 text-xs">
            {ar
              ? "ستُنسب الخدمات المستوردة إلى هذا المزود. تحقق من أن رابط API والمفتاح يخصّانه."
              : "Imported services will belong to this provider. Check that the API URL and key belong to it."}
          </p>
        </div>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-danger">
          {query.error.message}
        </p>
      )}
      {query.data?.length === 50 && (
        <p className="text-sm text-muted-foreground">
          {ar
            ? "اكتب الاسم للوصول إلى مزود آخر."
            : "Search by name to find another provider."}
        </p>
      )}
    </div>
  );
}
