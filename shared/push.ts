import { z } from "zod";
import { messageLocale } from "./messaging";
export const pushEndpoint = z
  .string()
  .max(3000)
  .url()
  .refine(value => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname === "web.push.apple.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname))
    );
  }, "Unsupported push service");
export const pushSubscription = z
  .object({
    endpoint: pushEndpoint,
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}(==)?$/),
      })
      .strict(),
  })
  .strict();
export const pushSubscribeInput = z
  .object({
    subscription: pushSubscription,
    locale: messageLocale,
    identity: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const pushDeviceInput = z
  .object({
    endpoint: pushEndpoint,
    identity: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const pushCopy = {
  ar: {
    title: "إشعارات الهاتف",
    enable: "تفعيل إشعارات الهاتف",
    disable: "إيقاف إشعارات الهاتف",
    test: "تجربة إشعار",
    on: "مفعّلة على هذا الجهاز للرسائل الجديدة، حتى عند إغلاق التطبيق.",
    off: "فعّلها لاستقبال الرسائل الجديدة خارج الموقع. لن يظهر نص الرسالة على شاشة القفل.",
    blocked: "الإشعارات محظورة. اسمح بها من إعدادات المتصفح أو الهاتف.",
    unsupported:
      "على الآيفون، أضف الموقع إلى الشاشة الرئيسية وافتحه منها. استخدم متصفحًا يدعم الإشعارات.",
    update: "حدّث التطبيق وأعد فتحه لتفعيل إشعارات الهاتف.",
    unavailable: "إشعارات الهاتف غير متاحة حاليًا. جرّب تسجيل الدخول مجددًا.",
    error: "لم تكتمل العملية. تحقق من الاتصال وحاول مجددًا.",
    sent: "قُبل إرسال إشعار التجربة. تأكد من وصوله على جهازك.",
    body: "لديك رسالة جديدة. افتح ProviderBeacon لقراءتها.",
    testBody: "إشعارات ProviderBeacon جاهزة على هذا الجهاز.",
  },
  en: {
    title: "Phone notifications",
    enable: "Enable phone notifications",
    disable: "Turn off phone notifications",
    test: "Test notification",
    on: "Enabled on this device for new messages, even with the app closed.",
    off: "Receive new messages outside the site. Message text stays off the lock screen.",
    blocked:
      "Notifications are blocked. Allow them in your browser or phone settings.",
    unsupported:
      "On iPhone, add the site to your Home Screen and open it there. Use a browser supporting notifications.",
    update: "Update and reopen the app to enable phone notifications.",
    unavailable:
      "Phone notifications are currently unavailable. Try signing in again.",
    error: "The operation did not finish. Check your connection and try again.",
    sent: "The test was accepted for delivery. Check that it arrives on your device.",
    body: "You have a new message. Open ProviderBeacon to read it.",
    testBody: "ProviderBeacon notifications are ready on this device.",
  },
  es: {
    title: "Notificaciones del teléfono",
    enable: "Activar notificaciones",
    disable: "Desactivar notificaciones",
    test: "Probar notificación",
    on: "Activas en este dispositivo para mensajes nuevos, incluso con la aplicación cerrada.",
    off: "Recibe mensajes nuevos fuera del sitio. El texto no aparece en la pantalla bloqueada.",
    blocked:
      "Las notificaciones están bloqueadas. Permítelas en los ajustes del navegador o teléfono.",
    unsupported:
      "En iPhone, añade el sitio a la pantalla de inicio y ábrelo desde allí. Usa un navegador compatible.",
    update:
      "Actualiza y vuelve a abrir la aplicación para activar las notificaciones.",
    unavailable:
      "Las notificaciones no están disponibles. Intenta iniciar sesión nuevamente.",
    error:
      "No se completó la operación. Revisa tu conexión e inténtalo de nuevo.",
    sent: "Se aceptó el envío de prueba. Confirma que llegue a tu dispositivo.",
    body: "Tienes un mensaje nuevo. Abre ProviderBeacon para leerlo.",
    testBody:
      "Las notificaciones de ProviderBeacon están listas en este dispositivo.",
  },
  hi: {
    title: "फ़ोन सूचनाएँ",
    enable: "सूचनाएँ चालू करें",
    disable: "सूचनाएँ बंद करें",
    test: "सूचना का परीक्षण",
    on: "ऐप बंद होने पर भी इस डिवाइस पर नए संदेशों की सूचनाएँ चालू हैं।",
    off: "साइट के बाहर नए संदेश पाएँ। लॉक स्क्रीन पर संदेश का पाठ नहीं दिखेगा।",
    blocked: "सूचनाएँ अवरुद्ध हैं। फ़ोन या ब्राउज़र सेटिंग में अनुमति दें।",
    unsupported:
      "iPhone पर साइट को होम स्क्रीन पर जोड़ें और वहीं से खोलें। समर्थित ब्राउज़र का उपयोग करें।",
    update: "सूचनाएँ चालू करने के लिए ऐप अपडेट करके फिर खोलें।",
    unavailable: "सूचनाएँ अभी उपलब्ध नहीं हैं। फिर से साइन इन करें।",
    error: "प्रक्रिया पूरी नहीं हुई। कनेक्शन जाँचकर फिर कोशिश करें।",
    sent: "परीक्षण सूचना भेजने के लिए स्वीकार हुई। अपने डिवाइस पर जाँचें।",
    body: "आपको नया संदेश मिला है। पढ़ने के लिए ProviderBeacon खोलें।",
    testBody: "इस डिवाइस पर ProviderBeacon सूचनाएँ तैयार हैं।",
  },
  zh: {
    title: "手机通知",
    enable: "启用手机通知",
    disable: "关闭手机通知",
    test: "测试通知",
    on: "此设备已启用新消息通知，关闭应用后也可接收。",
    off: "离开网站后接收新消息。锁屏不会显示消息正文。",
    blocked: "通知已被阻止。请在浏览器或手机设置中允许通知。",
    unsupported:
      "在 iPhone 上，请将网站添加到主屏幕并从那里打开。请使用支持通知的浏览器。",
    update: "请更新并重新打开应用以启用通知。",
    unavailable: "通知暂不可用。请尝试重新登录。",
    error: "操作未完成。请检查连接后重试。",
    sent: "测试通知已被接受发送。请确认设备收到通知。",
    body: "您有一条新消息。打开 ProviderBeacon 阅读。",
    testBody: "此设备上的 ProviderBeacon 通知已就绪。",
  },
};
