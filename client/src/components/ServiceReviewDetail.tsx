import { ServiceScreeningDetail } from "./ServiceScreening";
import { pricingCopy, formatPrice, unitLabel } from "@/i18n/pricing";
import {
  priceCurrencies,
  priceUnits,
  type PriceCurrency,
  type PriceUnit,
} from "../../../shared/pricing";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { useAdminText, type AdminTextKey } from "@/i18n/admin";
import { catalogueLabel } from "@/i18n/review";
import { platforms, serviceTypes } from "../../../shared/serviceReview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import SourcePricingEditor from "./SourcePricingEditor";

const selectClass =
  "h-10 min-w-0 rounded-lg border border-border bg-card px-3 text-sm";
type Form = {
  platform: (typeof platforms)[number];
  category: (typeof serviceTypes)[number];
  countryCode: string;
  price: string;
  priceCurrency: PriceCurrency | "";
  priceUnit: PriceUnit | "";
  packageDescription: string;
  minOrder: string;
  maxOrder: string;
  refillMode: "unknown" | "none" | "manual" | "automatic" | "lifetime";
  refillDays: string;
  evidenceUrl: string;
  pricingConfirmed: boolean;
  policyReviewed: boolean;
  reason: string;
  revision: number;
};

export default function ServiceReviewDetail({
  id,
  onClose,
  onSaved,
}: {
  id: number;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const text = useAdminText();
  const { locale, dir } = useLocale();
  const pricing = pricingCopy[locale];
  const access = trpc.admin.access.useQuery();
  const canWrite = access.data?.permissions.includes("services.write");
  const query = trpc.admin.services.detail.useQuery(
    { id },
    { retry: false, refetchOnWindowFocus: false }
  );
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    const row = query.data?.service;
    if (!row) return;
    setForm({
      platform: platforms.includes(row.platform as (typeof platforms)[number])
        ? (row.platform as Form["platform"])
        : "Unknown",
      category: serviceTypes.includes(
        row.category as (typeof serviceTypes)[number]
      )
        ? (row.category as Form["category"])
        : "Other",
      countryCode: row.countryCode ?? "",
      price: row.priceAmount,
      priceCurrency: priceCurrencies.includes(
        row.priceCurrency as PriceCurrency
      )
        ? (row.priceCurrency as PriceCurrency)
        : "",
      priceUnit: row.priceUnit ?? "",
      packageDescription: row.packageDescription ?? "",
      minOrder: String(row.minOrder),
      maxOrder: String(row.maxOrder),
      refillMode: row.refillMode,
      refillDays: row.refillDays == null ? "" : String(row.refillDays),
      evidenceUrl: row.evidenceUrl ?? "",
      pricingConfirmed: false,
      policyReviewed: false,
      reason: "",
      revision: row.revision,
    });
  }, [query.data]);
  const error = (value: { message: string }) =>
    toast.error(
      text(
        (value.message === "review_conflict" ||
        value.message === "review_not_ready"
          ? value.message
          : "reviewFailed") as AdminTextKey
      )
    );
  const save = trpc.admin.services.editReview.useMutation({
    onSuccess: async () => {
      toast.success(text("reviewSaved"));
      await onSaved();
      await query.refetch();
    },
    onError: error,
  });
  const status = trpc.admin.services.update.useMutation({
    onSuccess: async () => {
      toast.success(text("serviceUpdated"));
      await onSaved();
      await query.refetch();
    },
    onError: error,
  });
  const busy = save.isPending || status.isPending;
  const row = query.data?.service;
  const update = (patch: Partial<Form>) =>
    setForm(current => (current ? { ...current, ...patch } : current));
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        closeLabel={text("cancelEdit")}
        dir={dir}
        className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-4xl"
      >
        <DialogTitle>{text("openReview")}</DialogTitle>
        <DialogDescription dir="auto">
          {row?.name ?? text("loading")}
        </DialogDescription>
        {query.isError ? (
          <p role="alert">
            {text("loadError")}{" "}
            <Button onClick={() => void query.refetch()}>
              {text("retry")}
            </Button>
          </p>
        ) : !row || !form ? (
          <p>{text("loading")}</p>
        ) : (
          <>
            <ServiceScreeningDetail key={`${row.id}:${row.revision}`} row={row} onSaved={() => { void query.refetch(); onSaved(); }}/>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                <bdi>{query.data?.providerName}</bdi>
              </Badge>
              <Badge variant="outline">{text(row.reviewStatus)}</Badge>
              <span className="text-xs text-muted-foreground">
                {text("revision")}: {row.revision} ·{" "}
                <bdi>#{row.externalId ?? row.id}</bdi>
              </span>
              {query.data?.stale && (
                <Badge variant="outline" className="text-warning">
                  {text("stale")}
                </Badge>
              )}
              {query.data?.providerStatus !== "active" && (
                <Badge variant="outline">{text("providerNotPublished")}</Badge>
              )}
            </div>
            <section className="rounded-xl border border-warning-border bg-warning-muted/60 p-4">
              <h3 className="font-semibold text-foreground">
                {text("blockers")}
              </h3>
              {query.data?.blockers.length ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-warning">
                  {query.data.blockers.map(issue => (
                    <li key={issue}>{text(issue as AdminTextKey)}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-success">
                  {text("noBlockers")}
                </p>
              )}
            </section>
            {row.sourceKind === "provider_api" && (
              <div className="space-y-2 rounded-xl border border-input bg-secondary/50 p-4">
                <p className="text-sm font-semibold">
                  {locale === "ar" ? "وحدة سعر المصدر: " : "Source rate unit: "}
                  {unitLabel(locale, {
                    priceCurrency: row.sourceCurrency,
                    priceUnit: row.sourcePriceUnit,
                    packageDescription: row.sourcePackageDescription,
                    catalogueListing: "api_source",
                  })}
                </p>
                {row.sourcePricingEvidenceUrl && (
                  <a
                    href={row.sourcePricingEvidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline"
                  >
                    {locale === "ar"
                      ? "دليل وحدة التسعير"
                      : "Pricing-unit evidence"}
                  </a>
                )}
                {access.data?.permissions.includes("services.review") && (
                  <SourcePricingEditor
                    items={[{ id: row.id, revision: row.revision }]}
                    disabled={busy}
                    onSaved={async () => {
                      await onSaved();
                      await query.refetch();
                    }}
                  />
                )}
              </div>
            )}
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault();
                save.mutate({
                  id,
                  ...form,
                  countryCode: form.countryCode.trim().toUpperCase() || null,
                  evidenceUrl: form.evidenceUrl.trim() || null,
                  price: Number(form.price),
                  priceCurrency: form.priceCurrency || null,
                  priceUnit: form.priceUnit || null,
                  packageDescription:
                    form.priceUnit === "package"
                      ? form.packageDescription.trim() || null
                      : null,
                  minOrder: Number(form.minOrder),
                  maxOrder: Number(form.maxOrder),
                  refillDays: form.refillDays ? Number(form.refillDays) : null,
                });
              }}
            >
              <fieldset
                disabled={!canWrite || busy || row.normalizationVersion === 0}
                className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"
              >
                <legend className="px-2 font-semibold">
                  {text("editService")}
                </legend>
                <label className="grid gap-2 text-sm">
                  {text("platform")}
                  <select
                    className={selectClass}
                    value={form.platform}
                    onChange={event =>
                      update({
                        platform: event.target.value as Form["platform"],
                      })
                    }
                  >
                    {platforms.map(value => (
                      <option key={value} value={value}>
                        {catalogueLabel(locale, value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  {text("serviceType")}
                  <select
                    className={selectClass}
                    value={form.category}
                    onChange={event =>
                      update({
                        category: event.target.value as Form["category"],
                      })
                    }
                  >
                    {serviceTypes.map(value => (
                      <option key={value} value={value}>
                        {catalogueLabel(locale, value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  {text("country")}
                  <Input
                    dir="ltr"
                    maxLength={2}
                    pattern="[A-Za-z]{2}"
                    value={form.countryCode}
                    onChange={event =>
                      update({ countryCode: event.target.value.toUpperCase() })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {text("countryHint")}
                  </span>
                </label>
                <div className="rounded-lg bg-muted p-3 text-sm sm:col-span-2">
                  <p className="font-semibold">
                    {pricing.sourceRate}:{" "}
                    <bdi dir="ltr">
                      {row.sourceCurrency ? `${row.sourceCurrency} ` : ""}
                      {row.sourceRate ?? "—"}
                    </bdi>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pricing.sourceHelp}
                  </p>
                </div>
                <label className="grid gap-2 text-sm">
                  {pricing.currency}
                  <select
                    className={selectClass}
                    value={form.priceCurrency}
                    required={form.pricingConfirmed}
                    onChange={event =>
                      update({
                        priceCurrency: event.target
                          .value as Form["priceCurrency"],
                        pricingConfirmed: false,
                      })
                    }
                  >
                    <option value="">{pricing.unknown}</option>
                    {priceCurrencies.map(value => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  {pricing.unit}
                  <select
                    className={selectClass}
                    value={form.priceUnit}
                    required={form.pricingConfirmed}
                    onChange={event =>
                      update({
                        priceUnit: event.target.value as Form["priceUnit"],
                        pricingConfirmed: false,
                      })
                    }
                  >
                    <option value="">{pricing.unknown}</option>
                    {priceUnits.map(value => (
                      <option key={value} value={value}>
                        {pricing[value]}
                      </option>
                    ))}
                  </select>
                </label>
                {form.priceUnit === "package" && (
                  <label className="grid gap-2 text-sm sm:col-span-2">
                    {pricing.packageDescription}
                    <Textarea
                      dir="auto"
                      minLength={8}
                      maxLength={300}
                      required={form.pricingConfirmed}
                      value={form.packageDescription}
                      onChange={event =>
                        update({
                          packageDescription: event.target.value,
                          pricingConfirmed: false,
                        })
                      }
                    />
                  </label>
                )}
                <label className="grid gap-2 text-sm">
                  {pricing.price}
                  <Input
                    required
                    dir="ltr"
                    type="number"
                    min="0.0001"
                    max="100000"
                    step="0.0001"
                    value={form.price}
                    onChange={event =>
                      update({
                        price: event.target.value,
                        pricingConfirmed: false,
                      })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {text(
                      row.pricingConfirmed
                        ? "confirmedPrice"
                        : "unconfirmedPrice"
                    )}
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  {text("minQuantity")}
                  <Input
                    required
                    dir="ltr"
                    type="number"
                    min="1"
                    max="2147483647"
                    step="1"
                    value={form.minOrder}
                    onChange={event => update({ minOrder: event.target.value })}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  {text("maxQuantity")}
                  <Input
                    required
                    dir="ltr"
                    type="number"
                    min={form.minOrder || 1}
                    max="2147483647"
                    step="1"
                    value={form.maxOrder}
                    onChange={event => update({ maxOrder: event.target.value })}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  {text("refill")}
                  <select
                    className={selectClass}
                    value={form.refillMode}
                    onChange={event =>
                      update({
                        refillMode: event.target.value as Form["refillMode"],
                      })
                    }
                  >
                    {(
                      [
                        "unknown",
                        "none",
                        "manual",
                        "automatic",
                        "lifetime",
                      ] as const
                    ).map(value => (
                      <option key={value} value={value}>
                        {text(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  {text("refillDays")}
                  <Input
                    disabled={
                      !["manual", "automatic"].includes(form.refillMode)
                    }
                    dir="ltr"
                    type="number"
                    min="1"
                    max="3650"
                    step="1"
                    value={form.refillDays}
                    onChange={event =>
                      update({ refillDays: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm sm:col-span-2">
                  {text("evidenceUrl")}
                  <Input
                    dir="ltr"
                    type="url"
                    maxLength={500}
                    placeholder="https://provider.example/services"
                    value={form.evidenceUrl}
                    onChange={event =>
                      update({ evidenceUrl: event.target.value })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {text("evidenceHelp")}
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm leading-6 sm:col-span-2">
                  <input
                    className="mt-1.5"
                    type="checkbox"
                    checked={form.pricingConfirmed}
                    onChange={event =>
                      update({ pricingConfirmed: event.target.checked })
                    }
                  />
                  {pricing.confirm}
                </label>
                <label className="flex items-start gap-3 text-sm leading-6 sm:col-span-2">
                  <input
                    className="mt-1.5"
                    type="checkbox"
                    checked={form.policyReviewed}
                    onChange={event =>
                      update({ policyReviewed: event.target.checked })
                    }
                  />
                  {text("confirmPolicy")}
                </label>
                <label className="grid gap-2 text-sm sm:col-span-2">
                  {text("actionReason")}
                  <Textarea
                    required
                    minLength={8}
                    maxLength={1000}
                    value={form.reason}
                    onChange={event => update({ reason: event.target.value })}
                    placeholder={text("reasonHint")}
                  />
                </label>
                <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                  {text("reviewResetHint")}
                </p>
                {canWrite && (
                  <Button
                    className="sm:col-span-2"
                    disabled={form.reason.trim().length < 8}
                  >
                    {text("saveForReview")}
                  </Button>
                )}
              </fieldset>
            </form>
            <section className="rounded-xl border border-border p-4">
              <h3 className="font-semibold">{text("sourceDetails")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {row.sourceKind === "public_web"
                  ? locale === "ar"
                    ? "عرض معلن في موقع المزود"
                    : "Offer listed on the provider website"
                  : text(
                      row.sourceKind === "legacy" ? "legacySource" : "apiSource"
                    )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {text("sourceClaim")}
              </p>
              {row.sourceUrl && (
                <a
                  className="mt-2 block break-all text-sm text-foreground underline"
                  dir="ltr"
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.sourceUrl}
                </a>
              )}
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{text("lastSync")}</dt>
                  <dd>
                    {row.sourceUpdatedAt
                      ? new Date(row.sourceUpdatedAt).toLocaleString(locale)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{text("lastReview")}</dt>
                  <dd>
                    {row.reviewedAt
                      ? new Date(row.reviewedAt).toLocaleString(locale)
                      : "—"}
                  </dd>
                </div>
              </dl>
              {row.reviewReason && (
                <p
                  dir="auto"
                  className="mt-3 rounded-lg bg-muted p-3 text-sm"
                >
                  {row.reviewReason}
                </p>
              )}
              {row.classificationNotes?.length ? (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    {text("notes")}
                  </summary>
                  <ul className="mt-2 list-inside list-disc text-secondary-foreground">
                    {row.classificationNotes.map(note => (
                      <li key={note}>{text(note as AdminTextKey)}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {(
                [
                  ["latestSource", row.sourceData],
                  ["originalSource", row.originalSourceData],
                ] as const
              ).map(([label, data]) => (
                <details key={label} className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {text(label)}
                  </summary>
                  {data ? (
                    <pre
                      dir="ltr"
                      className="mt-2 max-h-60 overflow-auto rounded-lg bg-onyx p-3 text-start text-xs text-foreground"
                    >
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm">{text("noSource")}</p>
                  )}
                </details>
              ))}
            </section>
            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer font-semibold">
                {text("priceHistory")}
              </summary>
              {query.data?.prices.length ? (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-start">{text("time")}</th>
                      <th className="text-start">{text("rawPrice")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.prices.map(price => (
                      <tr key={price.id}>
                        <td className="py-2">
                          {new Date(price.capturedAt).toLocaleString(locale)}
                        </td>
                        <td>
                          <bdi dir="ltr">
                            {price.kind === "source"
                              ? formatPrice(locale, {
                                  ...price,
                                  catalogueListing: "api_source",
                                  sourceRate:
                                    price.sourceRate ?? price.priceAmount,
                                })
                              : formatPrice(locale, price)}
                          </bdi>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {price.kind === "source"
                              ? unitLabel(locale, {
                                  ...price,
                                  catalogueListing: "api_source",
                                })
                              : pricing[`history_${price.kind}`]}
                            {price.kind === "review"
                              ? ` · ${unitLabel(locale, price)}`
                              : ""}
                          </p>
                          {price.packageDescription && (
                            <p className="text-xs" dir="auto">
                              {price.packageDescription}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {text("noPriceHistory")}
                </p>
              )}
            </details>
            <div className="flex flex-wrap justify-end gap-2">
              {canWrite && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    status.mutate({
                      id,
                      status:
                        row.status === "paused" || row.status === "archived"
                          ? "draft"
                          : "paused",
                    })
                  }
                >
                  {text(
                    row.status === "paused" || row.status === "archived"
                      ? "returnDraft"
                      : "hideService"
                  )}
                </Button>
              )}
              <Button variant="outline" disabled={busy} onClick={onClose}>
                {text("cancelEdit")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
