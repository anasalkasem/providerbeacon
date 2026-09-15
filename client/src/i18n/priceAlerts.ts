import type { Locale } from "@/contexts/LocaleContext";

const en = {
  title: "Price alert by email",
  consent: "Email me when this quantity costs my target or less.",
  help: "One email per target setting, even if you are away. An already reached target can notify you after saving. Change the target, or switch off and on, to start a new alert. Depends on provider updates; prices older than 24 hours are paused.",
  verification: "Verify your email in account settings to enable alerts.",
  settings: "Account settings",
  unavailable:
    "Email alerts are currently unavailable for this account. You can still save an in-app target.",
  unconfirmed:
    "A recent, confirmed price with unchanged terms is required to enable email alerts.",
  required: "Enter a target total before enabling email alerts.",
  stop: "Stop this email alert",
  stopped: "Email alert stopped",
  save: "Save target and preferences",
  watching: "Email alert active",
  paused: "Email alert paused: review price and terms",
  queued: "Target alert queued",
  accepted: "Alert sent",
  delivered: "Alert delivered",
  failed:
    "Alert could not be delivered. Check your email settings before restarting it.",
  recorded: "Target was already processed. Set a new alert if needed.",
  cancelled:
    "Alert cancelled: the price, terms or subscription changed. Set a new alert if needed.",
  unsubTitle: "Stop price-alert emails",
  unsubBody:
    "This stops email alerts for all your followed services. Your saved services, in-app targets, account emails and news subscription stay available.",
  unsubDone: "All price-alert emails have been switched off.",
};
type Copy = { [K in keyof typeof en]: string };
export const priceAlertCopy: Record<Locale, Copy> = {
  en,
  ar: {
    title: "تنبيه السعر بالإيميل",
    consent:
      "أرسل لي إيميل عندما تبلغ تكلفة هذه الكمية السعر الذي حددته أو أقل.",
    help: "رسالة واحدة لكل إعداد للهدف، حتى وأنت خارج الموقع. إذا كان الهدف محققاً، قد يصلك التنبيه بعد الحفظ. غيّر الهدف أو أوقف التنبيه وأعد تفعيله لبدء تنبيه جديد. يعتمد على تحديث المزوّد؛ يتوقف مؤقتاً إذا تجاوز عمر السعر 24 ساعة.",
    verification: "أكّد بريدك من إعدادات الحساب لتفعيل التنبيهات.",
    settings: "إعدادات الحساب",
    unavailable:
      "تنبيهات الإيميل غير متاحة لهذا الحساب حالياً. يمكنك حفظ هدف داخل اللوحة.",
    unconfirmed:
      "تفعيل الإيميل يحتاج سعراً حديثاً مؤكداً وشروطاً مطابقة للخدمة المحفوظة.",
    required: "أدخل السعر المستهدف للكمية قبل تفعيل الإيميل.",
    stop: "إيقاف إيميل هذه الخدمة",
    stopped: "تم إيقاف تنبيه الإيميل",
    save: "حفظ الهدف وخيار التنبيه",
    watching: "تنبيه الإيميل مفعّل",
    paused: "التنبيه متوقف مؤقتاً: راجع السعر والشروط",
    queued: "تنبيه الهدف بانتظار الإرسال",
    accepted: "تم إرسال التنبيه",
    delivered: "تم تسليم التنبيه",
    failed: "تعذّر تسليم التنبيه. راجع إعدادات بريدك قبل إعادة تفعيله.",
    recorded: "تمت معالجة هذا الهدف سابقاً. اضبط تنبيهاً جديداً عند الحاجة.",
    cancelled:
      "أُلغي التنبيه لتغيّر السعر أو الشروط أو الاشتراك. اضبط تنبيهاً جديداً عند الحاجة.",
    unsubTitle: "إيقاف تنبيهات الأسعار البريدية",
    unsubBody:
      "سيتم إيقاف إيميلات الأسعار لجميع الخدمات التي تتابعها. تبقى خدماتك المحفوظة وأهداف اللوحة ورسائل الحساب واشتراك الأخبار متاحة.",
    unsubDone: "تم إيقاف جميع تنبيهات الأسعار البريدية.",
  },
  es: {
    title: "Alerta de precio por correo",
    consent:
      "Enviarme un correo cuando esta cantidad cueste mi precio objetivo o menos.",
    help: "Un correo por configuración del objetivo, aunque no visites el sitio. Si ya se cumple, puedes recibirlo después de guardar. Cambia el objetivo o desactiva y reactiva la alerta para iniciar otra. Depende de las actualizaciones del proveedor; los precios de más de 24 horas se pausan.",
    verification:
      "Verifica tu correo en los ajustes de cuenta para activar alertas.",
    settings: "Ajustes de cuenta",
    unavailable:
      "Las alertas por correo no están disponibles para esta cuenta. Puedes guardar un objetivo en el panel.",
    unconfirmed:
      "Se requiere un precio reciente y confirmado con las mismas condiciones del servicio guardado.",
    required:
      "Introduce el precio objetivo de la cantidad antes de activar el correo.",
    stop: "Desactivar el correo de este servicio",
    stopped: "Alerta por correo desactivada",
    save: "Guardar objetivo y preferencias",
    watching: "Alerta por correo activa",
    paused: "Alerta pausada: revisa el precio y las condiciones",
    queued: "Alerta en cola",
    accepted: "Alerta enviada",
    delivered: "Alerta entregada",
    failed:
      "No se pudo entregar la alerta. Revisa tu correo antes de reactivarla.",
    recorded:
      "Este objetivo ya se procesó. Configura otra alerta si lo necesitas.",
    cancelled:
      "Alerta cancelada por cambios en el precio, las condiciones o la suscripción. Configura otra si lo necesitas.",
    unsubTitle: "Desactivar alertas de precios",
    unsubBody:
      "Se desactivarán los correos de precios de todos los servicios que sigues. Tus servicios guardados, objetivos del panel, correos de cuenta y suscripción a novedades seguirán disponibles.",
    unsubDone: "Se desactivaron todas las alertas de precios por correo.",
  },
  hi: {
    title: "ईमेल से मूल्य अलर्ट",
    consent: "इस मात्रा की लागत मेरे लक्ष्य या उससे कम होने पर ईमेल भेजें।",
    help: "हर लक्ष्य सेटिंग पर एक ईमेल, साइट खोले बिना भी। लक्ष्य पहले से पूरा है तो सहेजने के बाद सूचना मिल सकती है। नया अलर्ट शुरू करने के लिए लक्ष्य बदलें या बंद करके फिर चालू करें। यह प्रदाता के अपडेट पर निर्भर है; 24 घंटे से पुराने मूल्य पर अलर्ट रुकते हैं।",
    verification: "अलर्ट चालू करने के लिए खाता सेटिंग में ईमेल सत्यापित करें।",
    settings: "खाता सेटिंग",
    unavailable:
      "इस खाते के लिए ईमेल अलर्ट अभी उपलब्ध नहीं हैं। डैशबोर्ड में लक्ष्य सहेज सकते हैं।",
    unconfirmed: "हाल का पुष्ट मूल्य और सहेजी गई सेवा जैसी शर्तें आवश्यक हैं।",
    required: "ईमेल चालू करने से पहले मात्रा का लक्षित कुल मूल्य भरें।",
    stop: "इस सेवा का ईमेल अलर्ट रोकें",
    stopped: "ईमेल अलर्ट बंद हुआ",
    save: "लक्ष्य और प्राथमिकताएँ सहेजें",
    watching: "ईमेल अलर्ट चालू",
    paused: "अलर्ट रुका: मूल्य और शर्तें जाँचें",
    queued: "अलर्ट भेजने की कतार में",
    accepted: "अलर्ट भेजा गया",
    delivered: "अलर्ट पहुँच गया",
    failed: "अलर्ट नहीं पहुँच सका। फिर चालू करने से पहले ईमेल सेटिंग जाँचें।",
    recorded:
      "इस लक्ष्य की प्रक्रिया हो चुकी है। ज़रूरत हो तो नया अलर्ट बनाएँ।",
    cancelled:
      "मूल्य, शर्तें या सदस्यता बदलने से अलर्ट रद्द हुआ। ज़रूरत हो तो नया अलर्ट बनाएँ।",
    unsubTitle: "मूल्य अलर्ट ईमेल बंद करें",
    unsubBody:
      "फ़ॉलो की गई सभी सेवाओं के मूल्य ईमेल बंद होंगे। सहेजी गई सेवाएँ, डैशबोर्ड लक्ष्य, खाता ईमेल और समाचार सदस्यता बनी रहेगी।",
    unsubDone: "सभी मूल्य अलर्ट ईमेल बंद कर दिए गए हैं।",
  },
  zh: {
    title: "价格邮件提醒",
    consent: "当此数量的总价达到或低于目标时给我发送邮件。",
    help: "每次目标设置仅生成一封邮件，无需打开网站。如果目标已达到，保存后即可收到提醒。更改目标或关闭后重新启用即可开始新的提醒。提醒依赖供应商更新，超过24小时的价格将暂停提醒。",
    verification: "请在账户设置中验证邮箱以启用提醒。",
    settings: "账户设置",
    unavailable: "此账户目前无法使用邮件提醒，仍可保存面板内的价格目标。",
    unconfirmed: "启用提醒需要近期已确认的价格，且条款须与保存时一致。",
    required: "启用邮件前请输入该数量的目标总价。",
    stop: "停止此服务的邮件提醒",
    stopped: "邮件提醒已关闭",
    save: "保存目标和提醒设置",
    watching: "邮件提醒已启用",
    paused: "提醒暂停：请检查价格和条款",
    queued: "目标提醒等待发送",
    accepted: "提醒已发送",
    delivered: "提醒已送达",
    failed: "提醒未能送达。重新启用前请检查邮箱设置。",
    recorded: "此目标已处理。如有需要，请设置新提醒。",
    cancelled: "由于价格、条款或订阅变化，提醒已取消。需要时请设置新提醒。",
    unsubTitle: "停止价格提醒邮件",
    unsubBody:
      "将停止所有已关注服务的价格邮件。已保存服务、面板目标、账户邮件和新闻订阅仍然保留。",
    unsubDone: "所有价格提醒邮件已关闭。",
  },
};

export function priceAlertStatus(status: string, locale: Locale) {
  const t = priceAlertCopy[locale];
  if (status === "processing" || status === "delayed") return t.queued;
  if (["failed", "bounced", "complained", "suppressed"].includes(status))
    return t.failed;
  return t[status as keyof Copy] ?? t.recorded;
}
