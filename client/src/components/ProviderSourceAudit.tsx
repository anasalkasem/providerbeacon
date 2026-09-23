import { useLocale } from "@/contexts/LocaleContext";
import { providerSourceCopy } from "@/i18n/providerSourceIdentity";
import { trpc } from "@/lib/trpc";
import { sourceMatchesWebsite } from "@shared/providerSourceIdentity";
import { Button } from "./ui/button";

export default function ProviderSourceAudit({ providerId, candidateUrl, confirmed = false, onConfirm }: {
  providerId: number; candidateUrl?: string; confirmed?: boolean; onConfirm?: (value: boolean) => void;
}) {
  const { locale } = useLocale();
  const copy = providerSourceCopy[locale];
  const report = trpc.admin.integrations.sourceIdentity.useQuery({ providerId }, { retry: false });
  const data = report.data;
  const status = (matches: boolean | null) => matches === true ? copy.same : matches === false ? copy.different : copy.unknown;
  const needsReview = data && [...data.sources, ...data.connections].some(row => row.matchesWebsite !== true);
  const candidateDiffers = data?.provider.websiteHost && sourceMatchesWebsite(`https://${data.provider.websiteHost}`, candidateUrl) === false;
  return <section aria-label={copy.title} className="min-w-0 space-y-4 rounded-2xl border border-border bg-secondary/30 p-4 text-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="font-extrabold text-foreground">{copy.title}{data && <> · {data.provider.name}</>}</h3><p className="mt-1 leading-6 text-secondary-foreground">{copy.body}</p></div><Button type="button" size="sm" variant="outline" disabled={report.isFetching} onClick={() => void report.refetch()}>{copy.retry}</Button></div>
    {report.isLoading && <p role="status">{copy.loading}</p>}
    {report.error && <p role="alert" className="text-danger">{copy.failed}</p>}
    {data && <>
      <p><span className="text-muted-foreground">{copy.website}: </span><bdi dir="ltr" className="break-all font-bold">{data.provider.websiteHost ?? copy.unknown}</bdi></p>
      {needsReview && <p role="status" className="rounded-xl border border-warning-border bg-warning-muted p-3 leading-6 text-warning">{copy.warning}</p>}
      <div><h4 className="font-bold text-foreground">{copy.connections}</h4>{data.connections.length ? <ul className="mt-2 space-y-2">{data.connections.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-xl border border-border bg-card p-3"><bdi dir="ltr" className="min-w-0 break-all">{row.host ?? copy.unknown}</bdi><span className={row.matchesWebsite === true ? "text-muted-foreground" : "text-warning"}>{status(row.matchesWebsite)}</span></li>)}</ul> : <p className="mt-2 text-muted-foreground">{copy.noConnections}</p>}</div>
      <div><h4 className="font-bold text-foreground">{copy.sources}</h4>{data.sources.length ? <ul className="mt-2 space-y-2">{data.sources.map((row, index) => <li key={`${row.host}:${index}`} className="rounded-xl border border-border bg-card p-3"><div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><bdi dir="ltr" className="min-w-0 break-all font-semibold">{row.host ?? copy.unknown}</bdi><span className={row.matchesWebsite === true ? "text-muted-foreground" : "text-warning"}>{status(row.matchesWebsite)}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{copy.count}: {row.count.toLocaleString(locale)} · {copy.sample}: <bdi>{row.sampleServiceId}</bdi></p></li>)}</ul> : <p className="mt-2 text-muted-foreground">{copy.empty}</p>}</div>
      {data.truncated && <p role="status" className="text-warning">{copy.truncated}</p>}
      {candidateDiffers && onConfirm && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-warning-border bg-warning-muted p-3 leading-6 text-foreground"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-sky-600" checked={confirmed} onChange={event => onConfirm(event.target.checked)}/><span>{copy.confirm}</span></label>}
    </>}
  </section>;
}
