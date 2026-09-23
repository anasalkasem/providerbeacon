import { PublicLayout } from "@/components/SiteChrome";
import { PublicPromotions } from "@/components/BusinessUi";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { catalogueExperience } from "@/i18n/catalogueExperience";
export default function ProviderOffers() {
  const { locale } = useLocale();
  const t = catalogueExperience[locale];
  return (
    <PublicLayout showCatalogueNotice={false}>
      <div className="container py-8">
        <div className="mb-6 rounded-xl border border-input bg-secondary/50 p-5 text-sm leading-7"><p>{t.offersHelp}</p><Link href="/services" className="mt-2 inline-flex min-h-11 items-center font-bold text-primary underline">{t.compare}</Link></div>
        <PublicPromotions />
      </div>
    </PublicLayout>
  );
}
