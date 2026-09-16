import { Bookmark, Check } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMember } from "@/hooks/useMember";
import { useLocale } from "@/contexts/LocaleContext";
import { workspaceCopy } from "@/i18n/workspace";
import type { PriceCurrency } from "../../../shared/pricing";

const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-beacon-500 hover:text-beacon-800 disabled:opacity-40";
function followReturnPath(quantity: number) {
  const params = new URLSearchParams(window.location.search);
  if (
    ["/compare", "/services"].includes(window.location.pathname) &&
    Number.isSafeInteger(quantity) &&
    quantity > 0
  )
    params.set("quantity", String(quantity));
  return window.location.pathname + (params.size ? `?${params}` : "");
}
export function FollowPrice({
  serviceId,
  quantity,
}: {
  serviceId: string;
  quantity: number;
}) {
  const member = useMember();
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const utils = trpc.useUtils();
  const ids = trpc.workspace.ids.useQuery(
    { accountId: member.data?.member?.id ?? 0 },
    { enabled: !!member.data?.member, staleTime: 30000, retry: false }
  );
  const saved =
    !!member.data?.member &&
    ids.data?.some(row => row.serviceId === Number(serviceId.slice(8)));
  const save = trpc.workspace.watch.useMutation({
    onSuccess: async () => {
      toast.success(t.savedNotice);
      await utils.workspace.invalidate();
    },
    onError: e =>
      toast.error(e.message === "workspace_limit" ? t.limit : t.error),
  });
  if (!member.data?.member)
    return (
      <Link
        className={button}
        href={`/sign-in?next=${encodeURIComponent(followReturnPath(quantity))}`}
      >
        <Bookmark className="size-4" />
        {t.signIn}
      </Link>
    );
  return (
    <button
      className={button}
      type="button"
      disabled={
        save.isPending ||
        saved ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 2147483647
      }
      onClick={() => save.mutate({ serviceId, quantity })}
    >
      {saved ? (
        <Check className="size-4 text-beacon-700" />
      ) : (
        <Bookmark className="size-4" />
      )}
      {saved ? t.saved : t.save}
    </button>
  );
}
export function SaveComparison({
  serviceIds,
  quantity,
  currency,
  name,
}: {
  serviceIds: string[];
  quantity: number;
  currency: PriceCurrency;
  name: string;
}) {
  const member = useMember();
  const utils = trpc.useUtils();
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const save = trpc.workspace.saveComparison.useMutation({
    onSuccess: async () => {
      toast.success(t.savedComparison);
      await utils.workspace.invalidate();
    },
    onError: e =>
      toast.error(e.message === "workspace_limit" ? t.limit : t.error),
  });
  if (!member.data?.member)
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(`/compare?${new URLSearchParams({ services: serviceIds.join(","), quantity: String(quantity), currency })}`)}`}
        className={button}
      >
        <Bookmark className="size-4" />
        {t.signIn}
      </Link>
    );
  return (
    <button
      className={button}
      disabled={
        save.isPending ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 2147483647
      }
      type="button"
      onClick={() =>
        save.mutate({
          serviceIds,
          quantity,
          currency,
          name: name.slice(0, 100) || t.comparisons,
        })
      }
    >
      <Bookmark className="size-4" />
      {t.saveComparison}
    </button>
  );
}
