import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "./ui/button";

const labels = {
  en: { page: "Page", next: "Next", previous: "Previous", loading: "Loading…" },
  ar: {
    page: "الصفحة",
    next: "التالي",
    previous: "السابق",
    loading: "جارٍ التحميل…",
  },
  es: {
    page: "Página",
    next: "Siguiente",
    previous: "Anterior",
    loading: "Cargando…",
  },
  hi: {
    page: "पृष्ठ",
    next: "अगला",
    previous: "पिछला",
    loading: "लोड हो रहा है…",
  },
  zh: { page: "页", next: "下一页", previous: "上一页", loading: "加载中…" },
};
export function CataloguePagination({
  onNavigate,
  pageSize,
}: { onNavigate?: () => void; pageSize?: number } = {}) {
  const { pagination, isFetching } = useMarketplaceData();
  const { locale } = useLocale();
  const t = labels[locale];
  if (!pagination) return null;
  const number = new Intl.NumberFormat(locale);
  const pages =
    pageSize && pagination.total > 0
      ? ` / ${number.format(Math.max(1, Math.ceil(pagination.total / pageSize)))}`
      : "";
  return (
    <nav
      className="catalogue-pagination mt-6 flex flex-wrap items-center justify-between gap-4"
      aria-label={t.page}
    >
      <p role="status" className="text-sm text-muted-foreground">
        {isFetching
          ? t.loading
          : `${t.page} ${number.format(pagination.page)}${pages}`}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={isFetching || pagination.page === 1}
          onClick={() => {
            onNavigate?.();
            pagination.previous();
          }}
        >
          {t.previous}
        </Button>
        <Button
          variant="outline"
          disabled={isFetching || !pagination.hasNext}
          onClick={() => {
            onNavigate?.();
            pagination.next();
          }}
        >
          {t.next}
        </Button>
      </div>
    </nav>
  );
}
