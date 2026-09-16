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
    <span className="inline-flex rounded-full border border-beacon-200 bg-beacon-50 px-2.5 py-1 text-xs font-semibold text-beacon-800">
      {communityCopy[locale].kinds[kind]}
    </span>
  );
}
