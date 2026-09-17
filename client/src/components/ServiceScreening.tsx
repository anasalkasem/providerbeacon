import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import {
  screeningLabels,
  type screeningStates,
  type screeningReasons,
} from "@shared/serviceScreening";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

export function ScreeningBadge({
  status,
  reason,
}: {
  status: (typeof screeningStates)[number];
  reason: string;
}) {
  const { locale } = useLocale();
  const t = screeningLabels[locale === "ar" ? "ar" : "en"];
  return (
    <div
      className={`mt-2 max-w-64 text-xs leading-5 ${status === "held" ? "text-red-700" : status === "clear" || status === "manual_clear" ? "text-emerald-700" : "text-slate-600"}`}
    >
      <strong>{t[status]}</strong>
      {reason !== "none" && (
        <p>{t[reason as (typeof screeningReasons)[number]] ?? reason}</p>
      )}
    </div>
  );
}
export function ServiceScreeningPanel({
  onFilter,
  selected,
}: {
  onFilter: (filter?: "held" | "review" | "pending") => void;
  selected?: string;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const summary = trpc.admin.services.screeningSummary.useQuery(undefined, {
    enabled: !!access.data?.permissions.includes("services.read"),
    retry: false,
    refetchInterval: 15000,
  });
  const toggle = trpc.admin.services.screeningToggle.useMutation({
    onSuccess: () => utils.admin.services.screeningSummary.invalidate(),
    onError: () =>
      toast.error(
        ar ? "تعذر تغيير حالة الفحص" : "Could not change screening state"
      ),
  });
  const data = summary.data;
  return (
    <section className="rounded-2xl border border-beacon-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">
          {ar
            ? "تنقية الخدمات بالذكاء الاصطناعي"
            : "Automatic service screening"}
        </h2>
        {data && access.data?.permissions.includes("services.review") && (
          <Button
            variant="outline"
            size="sm"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ enabled: !data.enabled })}
          >
            {data.enabled
              ? ar
                ? "إيقاف الفحص مؤقتًا"
                : "Pause screening"
              : ar
                ? "تشغيل الفحص"
                : "Enable screening"}
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        {ar
          ? "فحص تلقائي للخدمات الجديدة والمتغيرة. يُحجب المحتوى غير الصالح مع الاحتفاظ به للمراجعة. اجتياز الفحص لا يثبت جودة التنفيذ أو صحة أساس التسعير."
          : "New and changed services are screened automatically. Invalid content is hidden and retained for review. Passing does not verify delivery quality or the pricing basis."}
      </p>
      {summary.isError ? (
        <p role="alert" className="mt-3 text-red-700">
          {ar ? "تعذر تحميل حالة الفحص" : "Could not load screening status"}{" "}
          <Button variant="outline" onClick={() => summary.refetch()}>
            {ar ? "إعادة المحاولة" : "Retry"}
          </Button>
        </p>
      ) : !data ? (
        <p className="mt-3">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
      ) : (
        <>
          <p role="status" className="mt-3 text-sm font-semibold">
            {!data.configured
              ? ar
                ? "اتصال الذكاء الاصطناعي غير مهيأ؛ الفحص لم يبدأ."
                : "AI connection is not configured; screening has not started."
              : !data.workerEnabled || !data.enabled
                ? ar
                  ? "الفحص متوقف؛ قرارات الحجب الحالية محفوظة."
                  : "Screening paused; existing holds remain."
                : data.lastError === "daily_limit"
                  ? ar
                    ? "وصل الفحص للحد اليومي؛ يستأنف تلقائيًا غدًا بتوقيت UTC."
                    : "Daily limit reached; resumes automatically on the next UTC day."
                  : data.lastError
                    ? ar
                      ? "الاتصال متعثر؛ ستعاد المحاولة تلقائيًا دون حجب إضافي بسبب العطل."
                      : "Connection interrupted; automatic retries do not add holds because of an outage."
                    : ar
                      ? "الفحص التلقائي مفعّل"
                      : "Automatic screening enabled"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                {
                  filter: undefined,
                  value: data.checked,
                  label: ar ? "تم فحصها" : "Screened",
                },
                {
                  filter: "pending",
                  value: data.queued,
                  label: ar ? "في قائمة الفحص" : "Queued",
                },
                {
                  filter: "held",
                  value: data.held,
                  label: ar ? "محجوبة" : "Hidden",
                },
                {
                  filter: "review",
                  value: data.review,
                  label: ar ? "للمراجعة البشرية" : "Human review",
                },
              ] as const
            ).map((item, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={selected === item.filter}
                onClick={() => onFilter(item.filter)}
                className={`rounded-xl border p-3 text-start ${selected === item.filter ? "border-beacon-500 bg-beacon-50" : "border-slate-200"}`}
              >
                <strong className="block text-2xl">
                  {item.value.toLocaleString(locale)}
                </strong>
                <span className="text-xs text-slate-600">{item.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {ar
              ? "يشمل المزودين النشطين. الفحص يتم على دفعات ويستأنف بعد الانقطاع. الطلبات اليوم:"
              : "Active providers only. Batches resume after interruptions. Requests today:"}{" "}
            <bdi>
              {data.requestsToday} / {data.dailyLimit}
            </bdi>
            {data.lastRunAt && (
              <>
                {" "}
                · {ar ? "آخر تشغيل:" : "Last run:"}{" "}
                <bdi>{data.lastRunAt.toLocaleString(locale)}</bdi>
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}

type ReviewService =
  inferRouterOutputs<AppRouter>["admin"]["services"]["detail"]["service"];
export function ServiceScreeningDetail({
  row,
  onSaved,
}: {
  row: ReviewService;
  onSaved: () => void;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const [reason, setReason] = useState("");
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const change = trpc.admin.services.screeningDecide.useMutation({
    onSuccess: async () => {
      setReason("");
      await utils.admin.services.invalidate();
      onSaved();
    },
    onError: error =>
      toast.error(
        error.data?.code === "CONFLICT"
          ? ar
            ? "تغيرت الخدمة؛ حدّث التفاصيل وأعد المحاولة."
            : "Service changed. Refresh and retry."
          : error.message === "screening_fix_source_first"
            ? ar
              ? "صحّح بيانات المصدر أولًا قبل رفع الحجب."
              : "Correct source data before releasing this hold."
            : ar
              ? "تعذر حفظ قرار الفحص."
              : "Could not save screening decision."
      ),
  });
  return (
    <section className="rounded-xl border border-beacon-200 bg-beacon-50/30 p-4">
      <h3 className="font-bold">
        {ar ? "نتيجة التنقية التلقائية" : "Automatic screening result"}
      </h3>
      <ScreeningBadge
        status={row.screeningStatus}
        reason={row.screeningReason}
      />
      {row.screeningEvidence && (
        <blockquote
          className="mt-2 break-words rounded-lg bg-white p-3 text-sm"
          dir="auto"
        >
          {row.screeningEvidence}
        </blockquote>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {row.screeningModel === "manual"
          ? ar
            ? "قرار يدوي مسجل"
            : "Recorded manual decision"
          : (row.screeningModel ?? "—")}{" "}
        · {row.screeningCheckedAt?.toLocaleString(locale) ?? "—"}
      </p>
      {row.screeningRevision !== row.revision && (
        <p className="mt-2 text-xs">
          {ar
            ? "النسخة الحالية تنتظر الفحص. يبقى أي حجب سابق حتى صدور قرار جديد."
            : "This revision awaits screening. Existing holds remain until a new decision."}
        </p>
      )}
      {row.screeningError && (
        <p role="status" className="mt-2 text-xs text-amber-800">
          {ar
            ? "تعذر إكمال الفحص؛ ستعاد المحاولة تلقائيًا."
            : "Screening could not complete; an automatic retry is scheduled."}
        </p>
      )}
      {access.data?.permissions.includes("services.review") && (
        <div className="mt-4">
          <label
            className="block text-sm font-semibold"
            htmlFor={`screening-reason-${row.id}`}
          >
            {ar
              ? "سبب القرار (8 أحرف على الأقل)"
              : "Decision reason (at least 8 characters)"}
          </label>
          <Textarea
            id={`screening-reason-${row.id}`}
            className="mt-2"
            value={reason}
            maxLength={500}
            onChange={event => setReason(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                "retry",
                row.screeningStatus === "held" ? "release" : "hold",
              ] as const
            ).map(action => (
              <Button
                key={action}
                size="sm"
                variant="outline"
                disabled={reason.trim().length < 8 || change.isPending}
                onClick={() =>
                  change.mutate({
                    id: row.id,
                    revision: row.revision,
                    action,
                    reason,
                  })
                }
              >
                {action === "retry"
                  ? ar
                    ? "إعادة الفحص"
                    : "Screen again"
                  : action === "release"
                    ? ar
                      ? "رفع الحجب بعد المراجعة"
                      : "Release after review"
                    : ar
                      ? "حجب الخدمة"
                      : "Hide service"}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {ar
              ? "رفع الحجب لا يلغي شروط النشر. أي تغيير في الخدمة يعيدها للفحص."
              : "Releasing a hold does not waive publication requirements. Changes trigger another screening."}
          </p>
        </div>
      )}
    </section>
  );
}
