import type { Service } from "@/data/marketplace";
import { useLocale, type Locale } from "@/contexts/LocaleContext";
import { localizeData } from "@/i18n/messages";

export const serviceName = (locale: Locale, service: Service) => locale === "ar" && service.nameAr ? service.nameAr : localizeData(locale, service.name);
export const serviceScope = (locale: string, service: Service) => locale === "ar" && service.packageDescriptionAr ? service.packageDescriptionAr : service.packageDescription;
export const serviceTerms = (locale: string, service: Service) => locale === "ar" && service.termsAr ? service.termsAr : service.terms;

export default function OfferEvidence({ service, showTerms = false }: { service: Service; showTerms?: boolean }) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  if (!service.sourceUrl) return null;
  const stale = !service.checkedAt || Date.now() - new Date(service.checkedAt).getTime() > 30 * 86400000;
  return <div className="mt-3 max-w-sm space-y-2 text-xs leading-5 text-muted-foreground">
    {service.catalogueListing === "api_source" && <p className="font-bold text-foreground">{ar ? "مستورد من اتصال API الفعلي" : "Imported through the connected API"}</p>}
    {showTerms && serviceTerms(locale, service) && <p>{serviceTerms(locale, service)}</p>}
    <a className="inline-block font-bold text-foreground underline underline-offset-4" href={service.sourceUrl} target="_blank" rel="noopener noreferrer">{ar ? "راجع السعر لدى المزود" : "Check price at source"}</a>
    <p className={stale ? "font-bold text-warning" : ""}>{stale ? (ar ? "المصدر يحتاج إلى تحديث" : "Source needs an update") : (ar ? "آخر فحص" : "Last checked")}{service.checkedAt && <> · <time dateTime={service.checkedAt}>{new Date(service.checkedAt).toLocaleDateString(locale)}</time></>}</p>
  </div>;
}
