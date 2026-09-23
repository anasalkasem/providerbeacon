import { useLocale } from "@/contexts/LocaleContext";
import { catalogueExperience } from "@/i18n/catalogueExperience";
import { PublicLayout } from "@/components/SiteChrome";
import { VipAlbum } from "@/components/VipAlbum";
export default function VipProviders() {
  const { locale } = useLocale();
  return (
    <PublicLayout>
      <VipAlbum full title={catalogueExperience[locale].ads} />
    </PublicLayout>
  );
}
