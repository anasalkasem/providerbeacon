import { PublicLayout } from "@/components/SiteChrome";
import { PublicPromotions } from "@/components/BusinessUi";
export default function ProviderOffers() {
  return (
    <PublicLayout showCatalogueNotice={false}>
      <div className="container py-8">
        <PublicPromotions />
      </div>
    </PublicLayout>
  );
}
