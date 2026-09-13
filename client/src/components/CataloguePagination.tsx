import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "./ui/button";

const labels = {
  en: { page: "Page", next: "Next", previous: "Previous", loading: "Loading…" },
  ar: { page: "الصفحة", next: "التالي", previous: "السابق", loading: "جارٍ التحميل…" },
  es: { page: "Página", next: "Siguiente", previous: "Anterior", loading: "Cargando…" },
  hi: { page: "पृष्ठ", next: "अगला", previous: "पिछला", loading: "लोड हो रहा है…" },
  zh: { page: "页", next: "下一页", previous: "上一页", loading: "加载中…" },
};
export function CataloguePagination() {
  const { pagination, isFetching } = useMarketplaceData();
  const { locale } = useLocale();
  const t = labels[locale];
  if (!pagination) return null;
  return <nav className="mt-6 flex flex-wrap items-center justify-between gap-4" aria-label={t.page}>
    <p role="status" className="text-sm text-slate-500">{isFetching ? t.loading : `${t.page} ${new Intl.NumberFormat(locale).format(pagination.page)}`}</p>
    <div className="flex gap-2"><Button variant="outline" disabled={isFetching || pagination.page === 1} onClick={pagination.previous}>{t.previous}</Button><Button variant="outline" disabled={isFetching || !pagination.hasNext} onClick={pagination.next}>{t.next}</Button></div>
  </nav>;
}
