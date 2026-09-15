import { useState } from "react";
import { Mail, Eye, Send, CheckCircle2, Clock3 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, localeNames, type Locale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import type { CustomerEmailInput } from "@shared/email";

export default function AdminEmail() {
  const { locale } = useLocale();
  const ar = locale === "ar",
    es = locale === "es";
  const t = (en: string, arabic: string, spanish?: string) =>
    ar ? arabic : es && spanish ? spanish : en;
  const utils = trpc.useUtils(),
    access = trpc.admin.access.useQuery();
  const canRead = Boolean(access.data?.permissions.includes("emails.read")),
    canSend = Boolean(access.data?.permissions.includes("emails.send"));
  const status = trpc.admin.email.status.useQuery(undefined, {
    enabled: canRead,
    retry: false,
    refetchInterval: 15000,
  });
  const [q, setQ] = useState(""),
    [recipientCursor, setRecipientCursor] = useState<number>(),
    [historyCursor, setHistoryCursor] = useState<number>();
  const recipients = trpc.admin.email.recipients.useQuery(
    { q, cursor: recipientCursor },
    { enabled: canRead, retry: false }
  );
  const history = trpc.admin.email.history.useQuery(
    { cursor: historyCursor },
    { enabled: canRead, retry: false, refetchInterval: 15000 }
  );
  const [language, setLanguage] = useState<Locale>(locale),
    [kind, setKind] = useState<"welcome" | "verify" | "reset" | "security">(
      "welcome"
    );
  const template = trpc.admin.email.template.useQuery(
    { kind, locale: language },
    { enabled: canRead, retry: false }
  );
  const [message, setMessage] = useState<CustomerEmailInput>({
    memberId: 0,
    locale,
    subject: "",
    body: "",
    action: "/services",
  });
  const [confirmed, setConfirmed] = useState(false),
    [notice, setNotice] = useState("");
  const preview = trpc.admin.email.preview.useMutation();
  const send = trpc.admin.email.send.useMutation({
    onSuccess: async () => {
      setNotice(
        t(
          "Email queued. Delivery status is shown in the log.",
          "أُضيفت الرسالة إلى قائمة الإرسال. تابع حالة التسليم في السجل.",
          "Correo en cola. Consulta el estado de entrega en el registro."
        )
      );
      setConfirmed(false);
      preview.reset();
      await Promise.all([
        utils.admin.email.history.invalidate(),
        utils.admin.email.status.invalidate(),
      ]);
    },
  });
  const change = (value: Partial<CustomerEmailInput>) => {
    setMessage(old => ({ ...old, ...value }));
    setConfirmed(false);
    preview.reset();
    send.reset();
    setNotice("");
  };
  const statusText: Record<string, string> = {
    queued: t("Queued", "بانتظار الإرسال", "En cola"),
    processing: t("Sending", "جارٍ الإرسال", "Enviando"),
    accepted: t(
      "Accepted by email provider",
      "قبول مزود البريد",
      "Aceptado por el proveedor"
    ),
    delivered: t(
      "Delivered to recipient server",
      "تم التسليم لخادم المستلم",
      "Entregado al servidor"
    ),
    delayed: t("Delivery delayed", "تأخر التسليم", "Entrega retrasada"),
    bounced: t("Bounced", "مرتدة", "Rebotado"),
    complained: t("Spam complaint", "شكوى بريد مزعج", "Queja de spam"),
    suppressed: t("Suppressed", "موقوفة للمستلم", "Suprimido"),
    failed: t("Failed", "متعذرة", "Fallido"),
    cancelled: t("Cancelled", "ملغاة", "Cancelado"),
  };
  const errorText = (code?: string) =>
    code?.includes("ineligible") || code?.includes("suppressed")
      ? t(
          "Choose a verified customer who has opted in and can receive email.",
          "اختر عميلًا أكّد بريده واشترك بالتحديثات ويمكنه استقبال البريد.",
          "Elige un cliente verificado, suscrito y habilitado para recibir correos."
        )
      : code?.includes("expired")
        ? t(
            "Preview again before sending.",
            "أعد المعاينة قبل الإرسال.",
            "Vuelve a previsualizar antes de enviar."
          )
        : t(
            "Could not complete the request. Please try again.",
            "تعذّر إكمال الطلب. حاول مجددًا.",
            "No se pudo completar la solicitud. Inténtalo de nuevo."
          );
  const langSelect = (value: Locale, set: (value: Locale) => void) => (
    <select
      aria-label={t("Email language", "لغة الرسالة", "Idioma del correo")}
      className="h-11 rounded-lg border border-slate-300 bg-white px-3"
      value={value}
      onChange={e => set(e.target.value as Locale)}
    >
      {Object.entries(localeNames).map(([key, name]) => (
        <option key={key} value={key}>
          {name}
        </option>
      ))}
    </select>
  );
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-7">
        <header className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-800">
            <Mail />
          </span>
          <div>
            <p className="text-xs font-bold tracking-wider text-cyan-700">
              ProviderBeacon
            </p>
            <h1 className="text-3xl font-extrabold">
              {t("Customer email", "بريد العملاء", "Correo a clientes")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t(
                "Welcome, account security and customer updates",
                "الترحيب وأمان الحساب وتحديثات العملاء",
                "Bienvenida, seguridad y novedades"
              )}
            </p>
          </div>
        </header>
        {!canRead && !access.isLoading ? (
          <p role="alert">
            {t(
              "You do not have permission to view customer emails.",
              "ليست لديك صلاحية عرض بريد العملاء.",
              "No tienes permiso para ver los correos."
            )}
          </p>
        ) : (
          <>
            {(status.isError ||
              recipients.isError ||
              history.isError ||
              template.isError) && (
              <p role="alert" className="text-red-700">
                {errorText()}
              </p>
            )}
            <section
              className={`rounded-2xl border p-6 ${status.data?.enabled ? "border-teal-200 bg-teal-50" : "border-amber-200 bg-amber-50"}`}
            >
              <h2 className="flex items-center gap-2 font-bold">
                {status.data?.enabled ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <Clock3 className="size-5" />
                )}
                {status.data?.enabled
                  ? t(
                      "Email sending enabled",
                      "إرسال البريد مفعّل",
                      "Envío de correo habilitado"
                    )
                  : t(
                      "Email delivery awaits activation",
                      "الإرسال ينتظر التفعيل",
                      "El envío espera activación"
                    )}
              </h2>
              <p dir="ltr" className="mt-2 break-all text-sm">
                {status.data?.from}
              </p>
              <p className="mt-2 text-sm leading-6">
                {status.data?.enabled
                  ? t(
                      "Accepted means the email provider received the message; delivered means the recipient server accepted it.",
                      "القبول يعني استلام مزود البريد للرسالة؛ التسليم يعني قبول خادم المستلم لها.",
                      "Aceptado indica que el proveedor recibió el correo; entregado indica que lo aceptó el servidor del destinatario."
                    )
                  : t(
                      "Complete domain verification and email configuration before sending.",
                      "أكمل توثيق الدومين وإعدادات البريد لتفعيل الإرسال.",
                      "Completa la verificación del dominio y la configuración del correo."
                    )}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {status.data?.counts.map(c => (
                  <span
                    key={c.status}
                    className="rounded-lg bg-white px-3 py-2 text-xs"
                  >
                    {statusText[c.status] || c.status}:{" "}
                    <strong>{c.count}</strong>
                  </span>
                ))}
              </div>
            </section>
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-bold">
                {t(
                  "Automatic email templates",
                  "قوالب الرسائل التلقائية",
                  "Plantillas de correos automáticos"
                )}
              </h2>
              <div className="flex flex-wrap gap-3">
                {langSelect(language, setLanguage)}
                <select
                  aria-label={t("Template", "القالب", "Plantilla")}
                  className="h-11 rounded-lg border border-slate-300 bg-white px-3"
                  value={kind}
                  onChange={e => setKind(e.target.value as typeof kind)}
                >
                  <option value="welcome">
                    {t("Welcome", "الترحيب", "Bienvenida")}
                  </option>
                  <option value="verify">
                    {t(
                      "Email verification",
                      "تأكيد البريد",
                      "Confirmación de correo"
                    )}
                  </option>
                  <option value="reset">
                    {t(
                      "Password reset",
                      "استعادة كلمة المرور",
                      "Restablecer contraseña"
                    )}
                  </option>
                  <option value="security">
                    {t(
                      "Password changed",
                      "تغيير كلمة المرور",
                      "Cambio de contraseña"
                    )}
                  </option>
                </select>
              </div>
              {template.data && (
                <iframe
                  title={t(
                    "Automatic email preview",
                    "معاينة الرسالة التلقائية",
                    "Vista previa del correo automático"
                  )}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={template.data.html}
                  className="h-[620px] w-full rounded-xl border border-slate-200"
                />
              )}
            </section>
            {canSend && (
              <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold">
                  {t(
                    "Write a customer update",
                    "كتابة رسالة لعميل",
                    "Escribir a un cliente"
                  )}
                </h2>
                <p className="text-sm leading-7 text-slate-600">
                  {t(
                    "Choose one customer who has confirmed their email and subscribed to news and offers. Preview the full message before confirming delivery.",
                    "اختر عميلًا أكّد بريده واشترك بالأخبار والعروض. عاين الرسالة كاملة قبل تأكيد الإرسال.",
                    "Elige un cliente con correo confirmado y suscripción a novedades y ofertas. Previsualiza el mensaje antes de confirmar."
                  )}
                </p>
                <label className="grid gap-2 text-sm font-semibold">
                  {t("Find a customer", "البحث عن عميل", "Buscar cliente")}
                  <Input
                    maxLength={100}
                    value={q}
                    onChange={e => {
                      setQ(e.target.value);
                      setRecipientCursor(undefined);
                    }}
                  />
                </label>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                  {recipients.data?.items.map(m => (
                    <label
                      key={m.id}
                      className={`flex items-start gap-3 rounded-lg p-3 text-sm ${message.memberId === m.id ? "bg-blue-50" : "bg-slate-50"}`}
                    >
                      <input
                        type="radio"
                        name="recipient"
                        checked={message.memberId === m.id}
                        disabled={!m.verified || !m.subscribed}
                        onChange={() =>
                          change({
                            memberId: m.id,
                            locale: ["ar", "es", "hi", "zh", "en"].includes(
                              m.locale
                            )
                              ? (m.locale as Locale)
                              : "en",
                          })
                        }
                      />
                      <span>
                        <strong>{m.name}</strong>
                        <span dir="ltr" className="block break-all">
                          {m.email}
                        </span>
                        {(!m.verified || !m.subscribed) && (
                          <small className="text-amber-800">
                            {t(
                              "Verification and subscription required",
                              "يتطلب تأكيد البريد والاشتراك",
                              "Requiere verificación y suscripción"
                            )}
                          </small>
                        )}
                      </span>
                    </label>
                  ))}
                  {recipients.data?.items.length === 0 && (
                    <p className="p-3 text-sm text-slate-500">
                      {t(
                        "No customers found.",
                        "لا يوجد عملاء مطابقون.",
                        "No se encontraron clientes."
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRecipientCursor(undefined)}
                  >
                    {t("First page", "الصفحة الأولى", "Primera página")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!recipients.data?.nextCursor}
                    onClick={() =>
                      setRecipientCursor(recipients.data?.nextCursor)
                    }
                  >
                    {t("Next", "التالي", "Siguiente")}
                  </Button>
                </div>
                <form
                  className="space-y-4"
                  onSubmit={e => {
                    e.preventDefault();
                    setConfirmed(false);
                    send.reset();
                    preview.mutate(message);
                  }}
                >
                  {langSelect(message.locale, value =>
                    change({ locale: value })
                  )}
                  <label className="grid gap-2 text-sm font-semibold">
                    {t("Subject", "عنوان الرسالة", "Asunto")}
                    <Input
                      required
                      minLength={3}
                      maxLength={160}
                      value={message.subject}
                      onChange={e => change({ subject: e.target.value })}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    {t("Message", "نص الرسالة", "Mensaje")}
                    <Textarea
                      dir={message.locale === "ar" ? "rtl" : "ltr"}
                      className="min-h-48"
                      required
                      minLength={10}
                      maxLength={6000}
                      value={message.body}
                      onChange={e => change({ body: e.target.value })}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    {t(
                      "Button destination",
                      "وجهة زر الرسالة",
                      "Destino del botón"
                    )}
                    <select
                      className="h-11 rounded-lg border border-slate-300 bg-white px-3"
                      value={message.action}
                      onChange={e =>
                        change({
                          action: e.target
                            .value as CustomerEmailInput["action"],
                        })
                      }
                    >
                      <option value="/services">
                        {t("Services", "الخدمات", "Servicios")}
                      </option>
                      <option value="/compare">
                        {t("Comparison", "المقارنة", "Comparación")}
                      </option>
                      <option value="/providers">
                        {t("Providers", "المزوّدون", "Proveedores")}
                      </option>
                      <option value="/account">
                        {t("Account", "الحساب", "Cuenta")}
                      </option>
                    </select>
                  </label>
                  <Button
                    disabled={
                      !message.memberId || preview.isPending || send.isPending
                    }
                  >
                    <Eye className="size-4" />
                    {t(
                      "Preview message",
                      "معاينة الرسالة",
                      "Previsualizar mensaje"
                    )}
                  </Button>
                </form>
                {preview.data && (
                  <div className="space-y-4 border-t border-slate-200 pt-5">
                    <p dir="ltr" className="break-all text-sm">
                      {preview.data.from} → {preview.data.recipient.email}
                    </p>
                    <iframe
                      title={t(
                        "Customer email preview",
                        "معاينة رسالة العميل",
                        "Vista previa para el cliente"
                      )}
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={preview.data.html}
                      className="h-[620px] w-full rounded-xl border border-slate-200"
                    />
                    <label className="flex items-start gap-3 text-sm leading-6">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={e => setConfirmed(e.target.checked)}
                        className="mt-1 size-4"
                      />
                      {t(
                        "I reviewed this message and recipient and approve sending it.",
                        "راجعت الرسالة وعنوان المستلم وأوافق على إرسالها.",
                        "He revisado el mensaje y el destinatario y apruebo el envío."
                      )}
                    </label>
                    <Button
                      disabled={
                        !confirmed || !status.data?.enabled || send.isPending
                      }
                      onClick={() =>
                        send.mutate({
                          message,
                          proof: preview.data!.proof,
                          confirm: true,
                        })
                      }
                    >
                      <Send className="size-4" />
                      {t(
                        "Confirm and queue email",
                        "تأكيد وإضافة الرسالة للإرسال",
                        "Confirmar y poner en cola"
                      )}
                    </Button>
                  </div>
                )}
                {(preview.isError || send.isError) && (
                  <p role="alert" className="text-red-700">
                    {errorText(preview.error?.message || send.error?.message)}
                  </p>
                )}
                {notice && (
                  <p
                    role="status"
                    className="rounded-lg bg-teal-50 p-3 text-teal-900"
                  >
                    {notice}
                  </p>
                )}
              </section>
            )}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <h2 className="p-6 text-xl font-bold">
                {t("Email log", "سجل الرسائل", "Registro de correos")}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-start text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {[
                        t("Recipient", "المستلم", "Destinatario"),
                        t("Subject", "العنوان", "Asunto"),
                        t("Status", "الحالة", "Estado"),
                        t("Created", "وقت الإنشاء", "Creado"),
                      ].map(h => (
                        <th key={h} className="p-4 text-start">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.data?.items.map(row => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td dir="ltr" className="p-4">
                          {row.email}
                        </td>
                        <td className="p-4">
                          {row.subject}
                          <small className="mt-1 block text-slate-400">
                            #{row.id} · {row.locale}
                          </small>
                        </td>
                        <td className="p-4">
                          <span
                            className={`rounded-lg px-2 py-1 ${row.status === "delivered" ? "bg-teal-50 text-teal-800" : ["failed", "bounced", "complained"].includes(row.status) ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}
                          >
                            {statusText[row.status] || row.status}
                          </span>
                          {row.error && (
                            <small
                              dir="ltr"
                              className="mt-2 block text-slate-500"
                            >
                              {row.error}
                            </small>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-500">
                          {new Date(row.createdAt).toLocaleString(locale)}
                        </td>
                      </tr>
                    ))}
                    {history.data?.items.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-10 text-center text-slate-500"
                        >
                          {t(
                            "No emails have been queued yet.",
                            "لا توجد رسائل مسجلة بعد.",
                            "Todavía no hay correos registrados."
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 p-4">
                <Button
                  variant="outline"
                  onClick={() => setHistoryCursor(undefined)}
                >
                  {t("First page", "الصفحة الأولى", "Primera página")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!history.data?.nextCursor}
                  onClick={() => setHistoryCursor(history.data?.nextCursor)}
                >
                  {t("Next", "التالي", "Siguiente")}
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
