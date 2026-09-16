import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { toast } from "sonner";
import { Button } from "./ui/button";

export default function ProviderCataloguePublication({
  provider,
  canPublish,
}: {
  provider: {
    id: number;
    name: string;
    status: string;
    apiCataloguePublished: boolean;
    apiConnectionReady: boolean;
    apiServicesReady: boolean;
  };
  canPublish: boolean;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const utils = trpc.useUtils();
  const published =
    provider.apiCataloguePublished &&
    provider.apiConnectionReady &&
    provider.apiServicesReady &&
    provider.status === "active";
  const save = trpc.admin.providers.setCataloguePublication.useMutation({
    onSuccess: async () => {
      toast.success(
        ar
          ? "تم تحديث ظهور كتالوج المزود"
          : "Provider catalogue visibility updated"
      );
      await Promise.all([
        utils.admin.providers.page.invalidate(),
        utils.admin.providers.list.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.audit.list.invalidate(),
        utils.marketplace.snapshot.invalidate(),
      ]);
    },
    onError: error =>
      toast.error(
        error.message === "provider_suspended"
          ? ar
            ? "المزود موقوف. راجع حالته أولًا."
            : "The provider is suspended. Review its status first."
          : error.message === "api_catalogue_not_ready"
            ? ar
              ? "يلزم اتصال مفعل ومزامنة ناجحة بخدمات صالحة للعرض."
              : "An enabled connection and a successful sync with displayable services are required."
            : error.message
      ),
  });
  return (
    <div className="min-w-52 max-w-xs space-y-2">
      <p
        className={`text-sm font-bold ${published ? "text-beacon-700" : "text-slate-600"}`}
      >
        {published
          ? ar
            ? "كتالوج API منشور"
            : "API catalogue published"
          : ar
            ? "كتالوج API غير ظاهر"
            : "API catalogue not visible"}
      </p>
      <p className="text-xs leading-5 text-slate-500">
        {provider.status === "suspended"
          ? ar
            ? "المزود موقوف"
            : "Provider suspended"
          : !provider.apiConnectionReady
            ? ar
              ? "فعّل الاتصال وأكمل المزامنة أولًا"
              : "Enable the connection and complete a sync first"
            : !provider.apiServicesReady
              ? ar
                ? "لا توجد خدمات مستوردة قابلة للعرض. راجع نتيجة المزامنة والخدمات."
                : "No imported services are ready to display. Check the sync result and services."
              : provider.status !== "active"
                ? ar
                  ? "جاهز للنشر. الزر يفعّل ملف المزود وكتالوجه معًا."
                  : "Ready to publish. Publishing activates the provider profile and its catalogue."
                : ar
                  ? "عرض بيانات المزود المستوردة مع بقاء حالة مراجعتها واضحة."
                  : "Show imported provider data with its review status visible."}
      </p>
      {canPublish && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            save.isPending ||
            (!provider.apiCataloguePublished &&
              (!provider.apiConnectionReady ||
                !provider.apiServicesReady ||
                provider.status === "suspended"))
          }
          aria-label={`${provider.apiCataloguePublished ? (ar ? "إخفاء كتالوج API" : "Hide API catalogue") : ar ? "نشر ملف المزود وكتالوج API" : "Publish provider and API catalogue"}: ${provider.name}`}
          onClick={() =>
            save.mutate({
              id: provider.id,
              enabled: !provider.apiCataloguePublished,
              reason: provider.apiCataloguePublished
                ? "Administrator withdrew the connected source catalogue from the providers page."
                : "Administrator requested publication of the connected source catalogue from the providers page.",
            })
          }
        >
          {save.isPending
            ? ar
              ? "جارٍ الحفظ…"
              : "Saving…"
            : provider.apiCataloguePublished
              ? ar
                ? "إخفاء كتالوج API"
                : "Hide API catalogue"
              : ar
                ? "نشر ملف المزود وكتالوج API"
                : "Publish provider and API catalogue"}
        </Button>
      )}
    </div>
  );
}
