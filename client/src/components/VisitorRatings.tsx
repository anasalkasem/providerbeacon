import { useState } from "react";
import { Star } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import { useMember } from "@/hooks/useMember";
import { trpc } from "@/lib/trpc";
import { ratingsCopy } from "@/i18n/ratings";
import { Button } from "./ui/button";

export default function VisitorRatings({
  providerId,
  slug,
}: {
  providerId: number;
  slug: string;
}) {
  const { locale } = useLocale();
  const t = ratingsCopy[locale];
  const me = useMember();
  const summary = trpc.ratings.summary.useQuery(
    { providerId },
    { staleTime: 10000, retry: false }
  );
  return (
    <section id="visitor-ratings" className="container scroll-mt-24 pt-8">
      <div className="rounded-2xl border border-beacon-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-xl font-extrabold text-ink">{t.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{t.note}</p>
          </div>
          <div aria-live="polite">
            {summary.isLoading ? (
              <p>{t.loading}</p>
            ) : summary.isError ? (
              <p role="alert">
                {t.error}{" "}
                <Button variant="outline" onClick={() => summary.refetch()}>
                  {t.retry}
                </Button>
              </p>
            ) : summary.data?.rating != null ? (
              <div>
                <p className="flex items-center gap-2">
                  <Star className="size-6 fill-amber-400 text-amber-500" />
                  <bdi className="text-3xl font-extrabold">
                    {summary.data.rating.toLocaleString(locale, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-base text-slate-500">/ 5</span>
                  </bdi>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {summary.data.reviews.toLocaleString(locale)} {t.votes}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">{t.empty}</p>
            )}
          </div>
        </div>
        <div className="mt-6 border-t border-slate-100 pt-5">
          {me.isLoading ? (
            <p>{t.loading}</p>
          ) : me.isError ? (
            <p role="alert">
              {t.error}{" "}
              <Button variant="outline" onClick={() => me.refetch()}>
                {t.retry}
              </Button>
            </p>
          ) : !me.data?.member ? (
            <Button asChild>
              <Link
                href={`/sign-in?next=${encodeURIComponent(`/providers/${slug}#visitor-ratings`)}`}
              >
                {t.signIn}
              </Link>
            </Button>
          ) : !me.data.member.emailVerified ? (
            <Button asChild variant="outline">
              <Link href="/verify-email">{t.verify}</Link>
            </Button>
          ) : (
            <RatingForm
              key={`${providerId}:${me.data.member.id}`}
              providerId={providerId}
              accountId={me.data.member.id}
            />
          )}
        </div>
      </div>
    </section>
  );
}
function RatingForm({
  providerId,
  accountId,
}: {
  providerId: number;
  accountId: number;
}) {
  const { locale } = useLocale();
  const t = ratingsCopy[locale];
  const utils = trpc.useUtils();
  const own = trpc.ratings.mine.useQuery(
    { providerId, accountId },
    { retry: false, staleTime: 0 }
  );
  const [selected, setSelected] = useState<number | null>(null);
  const onError = (error: { data?: { code?: string } | null }) => {
    toast.error(error.data?.code === "CONFLICT" ? t.conflict : t.writeError);
    void own.refetch();
  };
  const refresh = async (removed: boolean) => {
    setSelected(null);
    toast.success(removed ? t.removed : t.saved);
    await Promise.all([
      utils.ratings.invalidate(),
      utils.marketplace.snapshot.invalidate(),
    ]);
  };
  const save = trpc.ratings.save.useMutation({
    onSuccess: () => refresh(false),
    onError,
  });
  const remove = trpc.ratings.remove.useMutation({
    onSuccess: () => refresh(true),
    onError,
  });
  const busy = save.isPending || remove.isPending;
  const stars = selected ?? own.data?.rating?.stars ?? 0;
  if (own.isLoading) return <p>{t.loading}</p>;
  if (own.isError || !own.data)
    return (
      <p role="alert">
        {t.error}{" "}
        <Button onClick={() => own.refetch()} variant="outline">
          {t.retry}
        </Button>
      </p>
    );
  return (
    <div>
      {own.data.isOwner ? (
        <p className="text-sm text-slate-600">{t.owner}</p>
      ) : (
        <>
          <fieldset disabled={busy} className="min-w-0">
            <legend className="font-bold text-slate-800">{t.your}</legend>
            <div className="mt-3 flex flex-wrap gap-1" aria-label={t.pick}>
              {[1, 2, 3, 4, 5].map(value => (
                <label
                  key={value}
                  className="relative cursor-pointer rounded-lg p-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-beacon-600"
                >
                  <input
                    type="radio"
                    name={`rating-${providerId}`}
                    value={value}
                    checked={stars === value}
                    onChange={() => setSelected(value)}
                    className="sr-only"
                    aria-label={`${value} ${t.stars}`}
                  />
                  <Star
                    aria-hidden="true"
                    className={`size-8 ${value <= stars ? "fill-amber-400 text-amber-500" : "text-slate-300"}`}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-2 text-xs text-slate-500">{t.edit}</p>
          <Button
            className="mt-4"
            disabled={
              !stars ||
              busy ||
              own.isFetching ||
              stars === own.data.rating?.stars
            }
            onClick={() =>
              save.mutate({
                providerId,
                accountId,
                stars,
                revision: own.data.rating?.revision ?? 0,
              })
            }
          >
            {t.save}
          </Button>
        </>
      )}
      {own.data.rating && (
        <Button
          variant="ghost"
          className="ms-2 mt-4"
          disabled={busy || own.isFetching}
          onClick={() =>
            remove.mutate({
              providerId,
              accountId,
              revision: own.data.rating!.revision,
            })
          }
        >
          {t.remove}
        </Button>
      )}
    </div>
  );
}
