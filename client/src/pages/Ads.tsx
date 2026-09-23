import { Link } from "wouter";
import { Plus, Megaphone } from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { PublicPromotions, businessPrimary } from "@/components/BusinessUi";
import { useLocale } from "@/contexts/LocaleContext";
import { adText } from "@/i18n/advertising";

export default function Ads() {
  const { locale } = useLocale();
  const t = adText(locale);
  return (
    <PublicLayout showCatalogueNotice={false}>
      <div className="container py-8 sm:py-12">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <Megaphone className="size-4" />
              ProviderBeacon
            </p>
            <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              {t.title}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t.intro}
            </p>
          </div>
          <Link href="/account/provider?tab=offers" className={businessPrimary}>
            <Plus className="size-4" />
            {t.add}
          </Link>
        </header>
        <PublicPromotions directory />
      </div>
    </PublicLayout>
  );
}
