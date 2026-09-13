import { formatPrice, unitLabel } from "@/i18n/pricing";
import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { CheckCheck, Eye, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { useAdminText, type AdminTextKey } from "@/i18n/admin";
import { catalogueLabel } from "@/i18n/review";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import ServiceReviewDetail from "./ServiceReviewDetail";
import ServiceReviewWorklist from "./ServiceReviewWorklist";
import {
  catalogueViews,
  platforms,
  reviewNeeds,
  type ReviewNeed,
} from "../../../shared/serviceReview";
import type { AdminServicesInput } from "../../../shared/catalogueQuery";

export const catalogueSelectClass =
  "h-10 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700";
type ReviewAction = "approve" | "requestChanges" | "publish";

export default function AdminServices({
  reviewMode = false,
}: {
  reviewMode?: boolean;
}) {
  const text = useAdminText();
  const { locale, dir } = useLocale();
  const searchParams = useSearch();
  const rawView = new URLSearchParams(searchParams).get("view");
  const rawNeed = new URLSearchParams(searchParams).get("need");
  const initialNeed = reviewNeeds.includes(rawNeed as ReviewNeed)
    ? (rawNeed as ReviewNeed)
    : undefined;
  const initialView = catalogueViews.includes(
    rawView as (typeof catalogueViews)[number]
  )
    ? (rawView as (typeof catalogueViews)[number])
    : "all";
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [filters, setFilters] = useState<AdminServicesInput>({
    limit: 25,
    q: "",
    view: initialView,
    need: initialNeed,
  });
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<{ id: number; revision: number }[]>(
    []
  );
  const [detailId, setDetailId] = useState<number | null>(null);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setFilters(current => ({
      ...current,
      view: initialView,
      need: initialNeed,
    }));
    setCursors([undefined]);
    setSelected([]);
  }, [initialView, initialNeed]);
  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => {
      setFilters(current => ({ ...current, q: search.trim() }));
      setCursors([undefined]);
      setSelected([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filters.q]);
  const query = trpc.admin.services.list.useQuery(
    { ...filters, cursor: cursors.at(-1) },
    {
      enabled: Boolean(access.data?.permissions.includes("services.read")),
      retry: false,
      staleTime: 15_000,
      gcTime: 120_000,
      placeholderData: keepPreviousData,
    }
  );
  const refresh = async () => {
    setSelected([]);
    await Promise.all([
      utils.admin.services.invalidate(),
      utils.admin.overview.invalidate(),
      utils.admin.audit.list.invalidate(),
      utils.marketplace.snapshot.invalidate(),
    ]);
  };
  const onSuccess = async () => {
    setAction(null);
    setReason("");
    toast.success(text("reviewSaved"));
    await refresh();
  };
  const onError = (error: { message: string }) =>
    toast.error(
      text(
        (["review_conflict", "review_not_ready"].includes(error.message)
          ? error.message
          : "reviewFailed") as AdminTextKey
      )
    );
  const approve = trpc.admin.services.approve.useMutation({
    onSuccess,
    onError,
  });
  const requestChanges = trpc.admin.services.requestChanges.useMutation({
    onSuccess,
    onError,
  });
  const publish = trpc.admin.services.publish.useMutation({
    onSuccess,
    onError,
  });
  const submitting =
    approve.isPending || requestChanges.isPending || publish.isPending;
  const change = (values: Partial<AdminServicesInput>) => {
    setFilters(current => ({ ...current, ...values }));
    setCursors([undefined]);
    setSelected([]);
  };
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const permissions = access.data?.permissions ?? [];
  const canReview = permissions.includes("services.review");
  const busy = query.isFetching || search.trim() !== filters.q;
  const rows = query.data?.items ?? [];
  const selectedRows = rows.filter(row =>
    selected.some(item => item.id === row.id)
  );
  const completeSelection =
    selected.length > 0 &&
    selectedRows.length === selected.length &&
    selectedRows.every(row => row.canApprove);
  const canPublish =
    completeSelection && selectedRows.every(row => row.canPublish);
  const actionLabel =
    action === "approve"
      ? "approveSelected"
      : action === "publish"
        ? "publishSelected"
        : "requestChanges";
  return (
    <section className="space-y-4" aria-label={text("serviceCatalogue")}>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="min-w-52 flex-1 text-xs font-semibold text-slate-600">
          {text("searchServices")}
          <div className="relative mt-2">
            <Search className="absolute start-3 top-3 size-4 text-slate-400" />
            <Input
              className="ps-9"
              value={search}
              maxLength={100}
              onChange={event => setSearch(event.target.value)}
              placeholder={text("searchServicesHint")}
            />
          </div>
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-600">
          {text("reviewState")}
          <select
            className={catalogueSelectClass}
            value={filters.view}
            onChange={event =>
              change({ view: event.target.value as AdminServicesInput["view"] })
            }
          >
            {catalogueViews.map(view => (
              <option key={view} value={view}>
                {text(view)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-600">
          {text("platform")}
          <select
            className={catalogueSelectClass}
            value={filters.platform ?? ""}
            onChange={event =>
              change({ platform: event.target.value || undefined })
            }
          >
            <option value="">{text("allPlatforms")}</option>
            {platforms.map(value => (
              <option key={value} value={value}>
                {catalogueLabel(locale, value)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-600">
          {text("status")}
          <select
            className={catalogueSelectClass}
            value={filters.status ?? ""}
            onChange={event =>
              change({
                status: (event.target.value ||
                  undefined) as AdminServicesInput["status"],
              })
            }
          >
            <option value="">{text("allStatuses")}</option>
            {(["draft", "active", "paused", "archived"] as const).map(
              status => (
                <option key={status} value={status}>
                  {text(status)}
                </option>
              )
            )}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-600">
          {text("country")}
          <Input
            dir="ltr"
            className="w-20"
            maxLength={2}
            placeholder="US"
            value={country}
            onChange={event => {
              const code = event.target.value
                .toUpperCase()
                .replace(/[^A-Z]/g, "");
              setCountry(code);
              if (code.length === 2 || code.length === 0)
                change({ countryCode: code || undefined });
            }}
          />
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-600">
          {text("rowsPerPage")}
          <select
            className={catalogueSelectClass}
            value={filters.limit}
            onChange={event => change({ limit: Number(event.target.value) })}
          >
            {[25, 50, 100].map(value => (
              <option key={value} value={value}>
                {number(value)}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setSelected([]);
            void query.refetch();
          }}
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {text("refresh")}
        </Button>
      </div>
      {reviewMode && (
        <ServiceReviewWorklist
          filters={filters}
          onSelect={need => change({ need })}
        />
      )}
      <div
        className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500"
        role="status"
        aria-live="polite"
      >
        <p>
          {text("matchingServices")}:{" "}
          <strong className="text-slate-900">
            {query.data ? number(query.data.total) : "—"}
          </strong>
        </p>
        <p>{text("publicationHint")}</p>
      </div>
      {canReview && (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4">
          <p className="text-sm leading-6 text-slate-600">
            {text("reviewHint")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {text("selected")}: {number(selected.length)}
            </Badge>
            <Button
              variant="outline"
              disabled={!selected.length || busy}
              onClick={() => setSelected([])}
            >
              {text("clearSelection")}
            </Button>
            <Button
              disabled={!completeSelection || busy}
              onClick={() => {
                setAction("approve");
                setReason("");
              }}
            >
              <CheckCheck className="size-4" />
              {text("approveSelected")}
            </Button>
            <Button
              variant="outline"
              disabled={!selected.length || busy}
              onClick={() => {
                setAction("requestChanges");
                setReason("");
              }}
            >
              {text("requestChanges")}
            </Button>
            {permissions.includes("services.publish") && (
              <Button
                variant="outline"
                disabled={!canPublish || busy}
                onClick={() => {
                  setAction("publish");
                  setReason("");
                }}
              >
                {text("publishSelected")}
              </Button>
            )}
          </div>
        </div>
      )}
      <div
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        aria-busy={busy}
      >
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full min-w-[960px] text-start">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                {canReview && (
                  <th className="p-4">
                    <input
                      type="checkbox"
                      aria-label={text("selectPage")}
                      checked={
                        Boolean(rows.length) &&
                        rows
                          .slice(0, 50)
                          .every(row =>
                            selected.some(item => item.id === row.id)
                          )
                      }
                      disabled={busy || !rows.length}
                      onChange={event =>
                        setSelected(
                          event.target.checked
                            ? rows.slice(0, 50).map(row => ({
                                id: row.id,
                                revision: row.revision,
                              }))
                            : []
                        )
                      }
                    />
                  </th>
                )}
                {[
                  "service",
                  "rawPrice",
                  "reviewState",
                  "sourceChecked",
                  "actions",
                ].map(header => (
                  <th
                    key={header}
                    className="border-b px-4 py-3 text-start text-xs font-semibold text-slate-500"
                  >
                    {text(header as AdminTextKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.isError ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-red-700">
                    {text("loadError")}{" "}
                    <Button
                      variant="outline"
                      onClick={() => void query.refetch()}
                    >
                      {text("retry")}
                    </Button>
                  </td>
                </tr>
              ) : query.isLoading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    {text("loading")}
                  </td>
                </tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    {text("noServices")}
                  </td>
                </tr>
              ) : (
                rows.map(service => {
                  const checked = selected.some(item => item.id === service.id);
                  const last = Math.max(
                    service.sourceUpdatedAt?.getTime() ?? 0,
                    service.priceCheckedAt?.getTime() ?? 0
                  );
                  return (
                    <tr
                      key={service.id}
                      className={
                        checked ? "bg-cyan-50/70" : "hover:bg-slate-50/70"
                      }
                    >
                      {canReview && (
                        <td className="p-4">
                          <input
                            type="checkbox"
                            aria-label={`${text("selectService")} ${service.externalId ?? service.id}`}
                            checked={checked}
                            disabled={
                              busy || (!checked && selected.length >= 50)
                            }
                            onChange={event =>
                              setSelected(
                                event.target.checked
                                  ? [
                                      ...selected,
                                      {
                                        id: service.id,
                                        revision: service.revision,
                                      },
                                    ]
                                  : selected.filter(
                                      item => item.id !== service.id
                                    )
                              )
                            }
                          />
                        </td>
                      )}
                      <td className="max-w-sm px-4 py-4">
                        <p
                          dir="auto"
                          className="break-words text-start text-sm font-semibold text-slate-900"
                        >
                          {service.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          <bdi>
                            {service.providerName} · #
                            {service.externalId ?? service.id}
                          </bdi>
                        </p>
                        <p className="mt-2 text-xs text-cyan-800">
                          <bdi>
                            {catalogueLabel(locale, service.platform)} ·{" "}
                            {catalogueLabel(locale, service.category)} ·{" "}
                            {service.countryCode ?? "—"}
                          </bdi>
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <bdi dir="ltr" className="font-semibold">
                          {formatPrice(locale, service)}
                        </bdi>
                        <p
                          className={`mt-1 max-w-36 text-xs ${service.pricingConfirmed ? "text-emerald-700" : "text-amber-700"}`}
                        >
                          {text(
                            service.pricingConfirmed
                              ? "confirmedPrice"
                              : "unconfirmedPrice"
                          )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{unitLabel(locale, service)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className={
                            service.reviewStatus === "approved"
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-amber-50 text-amber-800"
                          }
                        >
                          {text(service.reviewStatus)}
                        </Badge>
                        <p className="mt-2 text-xs text-slate-500">
                          {text(service.status)}
                          {service.incomplete ? ` · ${text("incomplete")}` : ""}
                        </p>
                        {!service.available && (
                          <p className="mt-1 text-xs text-red-700">
                            {text("missing")}
                          </p>
                        )}
                        {service.blockers.length > 0 && (
                          <ul
                            aria-label={text("blockers")}
                            className="mt-2 max-w-64 space-y-1 text-xs leading-5 text-amber-800"
                          >
                            {service.blockers.map(blocker => (
                              <li key={blocker}>
                                • {text(blocker as AdminTextKey)}
                              </li>
                            ))}
                          </ul>
                        )}
                        {service.stale && (
                          <p className="mt-2 text-xs font-semibold text-amber-800">
                            {text("stale")}
                          </p>
                        )}
                        {service.canApprove &&
                          service.reviewStatus !== "approved" && (
                            <p className="mt-2 text-xs font-semibold text-emerald-700">
                              {text("need_ready")}
                            </p>
                          )}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {last ? new Date(last).toLocaleDateString(locale) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => setDetailId(service.id)}
                        >
                          <Eye className="size-3" />
                          {text("openReview")}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <nav
          className="flex flex-wrap items-center justify-between gap-3 border-t p-4"
          aria-label={text("pagination")}
        >
          <p className="text-sm text-slate-500">
            {text("page")} {number(cursors.length)} · {number(rows.length)}{" "}
            {text("services")}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={cursors.length === 1 || busy}
              onClick={() => {
                setCursors(current => current.slice(0, -1));
                setSelected([]);
              }}
            >
              {text("previous")}
            </Button>
            <Button
              variant="outline"
              disabled={query.isError || !query.data?.nextCursor || busy}
              onClick={() => {
                setCursors(current => [...current, query.data!.nextCursor!]);
                setSelected([]);
              }}
            >
              {text("next")}
            </Button>
          </div>
        </nav>
      </div>
      {detailId != null && (
        <ServiceReviewDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onSaved={refresh}
        />
      )}
      <Dialog
        open={Boolean(action)}
        onOpenChange={open => {
          if (!open && !submitting) setAction(null);
        }}
      >
        <DialogContent dir={dir} closeLabel={text("cancelEdit")}>
          <DialogTitle>{text(actionLabel)}</DialogTitle>
          <DialogDescription>
            {text("selected")}: {number(selected.length)}.{" "}
            {text("actionReason")}
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              if (!action) return;
              ({ approve, requestChanges, publish })[action].mutate({
                items: selected,
                reason,
              });
            }}
          >
            <label className="grid gap-2 text-sm">
              {text("actionReason")}
              <Textarea
                required
                minLength={8}
                maxLength={1000}
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder={text("reasonHint")}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setAction(null)}
              >
                {text("cancelEdit")}
              </Button>
              <Button disabled={submitting || reason.trim().length < 8}>
                {text("confirmAction")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
