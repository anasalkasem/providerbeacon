import { communityKind } from "@shared/community";
import type { GroupLinkMetadata } from "@shared/linkMetadata";
import { useLocale } from "@/contexts/LocaleContext";
import { communityCopy } from "@/i18n/community";

export function CommunityKindBadge({
  url,
  data,
}: {
  url: string;
  data?: Pick<GroupLinkMetadata, "audience"> | null;
}) {
  const { locale } = useLocale();
  const kind = communityKind(url, data?.audience?.kind);
  if (!kind) return null;
  return (
    <span className="inline-flex rounded-full border border-input bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
      {communityCopy[locale].kinds[kind]}
    </span>
  );
}
