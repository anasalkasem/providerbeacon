import { memberLocale } from "../shared/memberAuth";
import { memberAuthOrigin } from "./memberSecurity";

export type MailKind = "welcome" | "verify" | "reset" | "security" | "customer";
const EMAIL_LOGO_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/88685962/XnmaySgPSyTkeTNP.png';

type Words = {
  welcome: string;
  welcomeBody: string;
  verify: string;
  verifyBody: string;
  reset: string;
  resetBody: string;
  security: string;
  securityBody: string;
  explore: string;
  account: string;
  resetAction: string;
  verifyAction: string;
  greeting: string;
  ignore: string;
  team: string;
  privacy: string;
  unsubscribe: string;
  reason: string;
  fallback: string;
  help: string;
};
const copy: Record<"en" | "ar" | "es" | "hi" | "zh", Words> = {
  en: {
    welcome: "Welcome to ProviderBeacon",
    welcomeBody:
      "Your account is ready. Explore providers, compare available services and prices, and ask Beacon for help understanding your options.",
    verify: "Welcome — confirm your email",
    verifyBody:
      "Thank you for joining ProviderBeacon. Confirm your email to secure your account. This link expires in 24 hours.",
    reset: "Reset your ProviderBeacon password",
    resetBody:
      "We received a request to reset your password. This link works once and expires in 30 minutes. After resetting, you will need to sign in again on all devices.",
    security: "Your ProviderBeacon password changed",
    securityBody:
      "The password for your account was changed. If you did not make this change, reset your password and contact our support team.",
    explore: "Explore services",
    account: "Open ProviderBeacon",
    resetAction: "Reset password",
    verifyAction: "Confirm email",
    greeting: "Hello",
    ignore:
      "If you did not request this, you can ignore this email. Do not share this link.",
    team: "The ProviderBeacon team",
    privacy: "Privacy",
    unsubscribe: "Unsubscribe from updates",
    reason:
      "You are receiving this update because you subscribed to ProviderBeacon emails.",
    fallback: "If the button does not work, copy this link into your browser:",
    help: "Need help? Reply to this email.",
  },
  ar: {
    welcome: "أهلًا بك في ProviderBeacon",
    welcomeBody:
      "حسابك جاهز. اكتشف المزوّدين، وقارن الخدمات والأسعار المتاحة، واستعن بمساعد Beacon لفهم الخيارات المناسبة لك.",
    verify: "أهلًا بك — أكّد بريدك الإلكتروني",
    verifyBody:
      "شكرًا لانضمامك إلى ProviderBeacon. أكّد بريدك الإلكتروني لحماية حسابك. تنتهي صلاحية هذا الرابط خلال 24 ساعة.",
    reset: "إعادة تعيين كلمة مرور ProviderBeacon",
    resetBody:
      "وصلنا طلب لإعادة تعيين كلمة مرور حسابك. يُستخدم هذا الرابط مرة واحدة وتنتهي صلاحيته خلال 30 دقيقة. بعد التغيير، ستحتاج إلى تسجيل الدخول مجددًا على جميع أجهزتك.",
    security: "تم تغيير كلمة مرور حسابك",
    securityBody:
      "تغيّرت كلمة مرور حسابك في ProviderBeacon. إذا لم تقم بهذا التغيير، أعد تعيين كلمة المرور وتواصل مع فريق الدعم.",
    explore: "اكتشف الخدمات",
    account: "افتح ProviderBeacon",
    resetAction: "إعادة تعيين كلمة المرور",
    verifyAction: "تأكيد البريد الإلكتروني",
    greeting: "مرحبًا",
    ignore:
      "إذا لم تطلب هذه الرسالة، يمكنك تجاهلها. لا تشارك هذا الرابط مع أحد.",
    team: "فريق ProviderBeacon",
    privacy: "الخصوصية",
    unsubscribe: "إلغاء الاشتراك في التحديثات",
    reason: "تصلك هذه الرسالة لأنك اشتركت في تحديثات ProviderBeacon البريدية.",
    fallback: "إذا لم يعمل الزر، انسخ هذا الرابط إلى المتصفح:",
    help: "تحتاج مساعدة؟ يمكنك الرد على هذه الرسالة.",
  },
  es: {
    welcome: "Te damos la bienvenida a ProviderBeacon",
    welcomeBody:
      "Tu cuenta está lista. Descubre proveedores, compara servicios y precios disponibles y consulta a Beacon para entender tus opciones.",
    verify: "Bienvenido: confirma tu correo",
    verifyBody:
      "Gracias por unirte a ProviderBeacon. Confirma tu correo para proteger tu cuenta. Este enlace caduca en 24 horas.",
    reset: "Restablece tu contraseña de ProviderBeacon",
    resetBody:
      "Recibimos una solicitud para restablecer tu contraseña. Este enlace solo puede usarse una vez y caduca en 30 minutos. Después tendrás que iniciar sesión de nuevo en todos tus dispositivos.",
    security: "Tu contraseña de ProviderBeacon ha cambiado",
    securityBody:
      "Se ha cambiado la contraseña de tu cuenta. Si no has hecho este cambio, restablece tu contraseña y contacta con nuestro equipo de soporte.",
    explore: "Descubrir servicios",
    account: "Abrir ProviderBeacon",
    resetAction: "Restablecer contraseña",
    verifyAction: "Confirmar correo",
    greeting: "Hola",
    ignore:
      "Si no solicitaste este mensaje, puedes ignorarlo. No compartas este enlace.",
    team: "El equipo de ProviderBeacon",
    privacy: "Privacidad",
    unsubscribe: "Cancelar suscripción a novedades",
    reason:
      "Recibes este mensaje porque te suscribiste a las novedades de ProviderBeacon.",
    fallback: "Si el botón no funciona, copia este enlace en tu navegador:",
    help: "¿Necesitas ayuda? Responde a este correo.",
  },
  hi: {
    welcome: "ProviderBeacon में आपका स्वागत है",
    welcomeBody:
      "आपका खाता तैयार है। प्रदाता खोजें, उपलब्ध सेवाओं और कीमतों की तुलना करें और अपने विकल्प समझने के लिए Beacon से मदद लें।",
    verify: "स्वागत है — अपना ईमेल सत्यापित करें",
    verifyBody:
      "ProviderBeacon से जुड़ने के लिए धन्यवाद। अपना खाता सुरक्षित रखने के लिए ईमेल सत्यापित करें। यह लिंक 24 घंटे में समाप्त हो जाएगा।",
    reset: "अपना ProviderBeacon पासवर्ड रीसेट करें",
    resetBody:
      "हमें पासवर्ड रीसेट करने का अनुरोध मिला है। यह लिंक एक बार इस्तेमाल किया जा सकता है और 30 मिनट में समाप्त हो जाएगा। इसके बाद सभी उपकरणों पर फिर से साइन इन करना होगा।",
    security: "आपका ProviderBeacon पासवर्ड बदल गया है",
    securityBody:
      "आपके खाते का पासवर्ड बदल दिया गया है। यदि आपने यह बदलाव नहीं किया, तो अपना पासवर्ड रीसेट करें और सहायता टीम से संपर्क करें।",
    explore: "सेवाएँ खोजें",
    account: "ProviderBeacon खोलें",
    resetAction: "पासवर्ड रीसेट करें",
    verifyAction: "ईमेल सत्यापित करें",
    greeting: "नमस्ते",
    ignore:
      "यदि आपने यह अनुरोध नहीं किया, तो इस ईमेल को अनदेखा करें। यह लिंक साझा न करें।",
    team: "ProviderBeacon टीम",
    privacy: "गोपनीयता",
    unsubscribe: "अपडेट की सदस्यता समाप्त करें",
    reason:
      "आपको यह ईमेल इसलिए मिला क्योंकि आपने ProviderBeacon अपडेट की सदस्यता ली है।",
    fallback: "यदि बटन काम न करे, तो यह लिंक ब्राउज़र में कॉपी करें:",
    help: "मदद चाहिए? इस ईमेल का जवाब दें।",
  },
  zh: {
    welcome: "欢迎加入 ProviderBeacon",
    welcomeBody:
      "您的账户已准备就绪。探索供应商，比较现有服务和价格，并向 Beacon 咨询以了解您的选择。",
    verify: "欢迎加入——请验证您的邮箱",
    verifyBody:
      "感谢您加入 ProviderBeacon。请验证邮箱以保护您的账户。此链接将在24小时后失效。",
    reset: "重置您的 ProviderBeacon 密码",
    resetBody:
      "我们收到了重置密码的请求。此链接仅可使用一次，将在30分钟后失效。重置后，您需要在所有设备上重新登录。",
    security: "您的 ProviderBeacon 密码已更改",
    securityBody:
      "您的账户密码已更改。如果这不是您的操作，请重置密码并联系支持团队。",
    explore: "探索服务",
    account: "打开 ProviderBeacon",
    resetAction: "重置密码",
    verifyAction: "验证邮箱",
    greeting: "您好",
    ignore: "如果您未发起此请求，可以忽略此邮件。请勿分享此链接。",
    team: "ProviderBeacon 团队",
    privacy: "隐私",
    unsubscribe: "取消订阅更新",
    reason: "您收到此邮件是因为您订阅了 ProviderBeacon 的邮件更新。",
    fallback: "如果按钮无法使用，请将此链接复制到浏览器：",
    help: "需要帮助？请直接回复此邮件。",
  },
};
export const escapeEmailHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );
export function emailLocale(value: string) {
  const result = memberLocale.safeParse(value);
  return result.success ? result.data : "en";
}
export function renderEmail(input: {
  kind: MailKind;
  locale: string;
  name: string;
  url: string;
  subject?: string;
  body?: string;
  unsubscribeUrl?: string;
}) {
  const locale = emailLocale(input.locale),
    w = copy[locale],
    e = escapeEmailHtml;
  const origin = memberAuthOrigin(),
    action = new URL(input.url);
  if (action.origin !== origin) throw new Error("Invalid email action origin");
  if (input.unsubscribeUrl && new URL(input.unsubscribeUrl).origin !== origin)
    throw new Error("Invalid unsubscribe origin");
  const kind = input.kind === "customer" ? "welcome" : input.kind;
  const subject = input.kind === "customer" ? input.subject! : w[kind];
  const body = input.kind === "customer" ? input.body! : w[`${kind}Body`];
  const label =
    input.kind === "verify"
      ? w.verifyAction
      : input.kind === "reset"
        ? w.resetAction
        : input.kind === "welcome"
          ? w.explore
          : w.account;
  const sensitive = input.kind === "verify" || input.kind === "reset";
  const greeting = `${w.greeting} ${input.name},`;
  const footer =
    input.kind === "customer" ? w.reason : sensitive ? w.ignore : "";
  const privacy = `${origin}/privacy?lang=${locale}`;
  const text = [
    subject,
    greeting,
    body,
    `${label}: ${action.href}`,
    footer,
    w.help,
    w.team,
    `${w.privacy}: ${privacy}`,
    ...(input.unsubscribeUrl
      ? [`${w.unsubscribe}: ${input.unsubscribeUrl}`]
      : []),
  ]
    .filter(Boolean)
    .join("\n\n");
  const html = `<!DOCTYPE html><html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(subject)}</title></head><body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Tahoma,sans-serif;color:#10243c"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(body.slice(0, 150))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dfe7f1;border-radius:18px"><tr><td style="padding:28px 32px;background:#071a35;border-radius:18px 18px 0 0;border-bottom:4px solid #35c8c0"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-right:12px"><img src="${e(EMAIL_LOGO_URL)}" alt="ProviderBeacon" width="44" height="44" style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none" /></td><td><a href="${origin}" style="font-size:24px;font-weight:bold;color:#ffffff;text-decoration:none" dir="ltr">Provider<span style="color:#68e0d2">Beacon</span></a></td></tr></table></td></tr><tr><td style="padding:32px;text-align:${locale === "ar" ? "right" : "left"}"><h1 style="margin:0 0 24px;font-size:25px;line-height:1.5;color:#0b2a68">${e(subject)}</h1><p style="font-size:16px;line-height:1.9;margin:0 0 14px">${e(greeting)}</p>${body
    .split(/\n+/)
    .map(
      p =>
        `<p style="font-size:16px;line-height:1.9;margin:0 0 14px;color:#405169">${e(p)}</p>`
    )
    .join(
      ""
    )}<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0"><tr><td bgcolor="#0b2a68" style="border-radius:9px"><a href="${e(action.href)}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">${e(label)}</a></td></tr></table>${sensitive ? `<p style="font-size:12px;line-height:1.7;color:#64748b">${e(w.fallback)}</p><p dir="ltr" style="font-size:12px;word-break:break-all"><a style="color:#0b2a68" href="${e(action.href)}">${e(action.href)}</a></p>` : ""}<p style="font-size:13px;line-height:1.8;color:#64748b">${e(footer)}</p><p style="font-size:14px;line-height:1.8">${e(w.help)}<br><strong>${e(w.team)}</strong></p></td></tr><tr><td style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 18px 18px;font-size:12px;line-height:1.9;color:#64748b"><a style="color:#405169" href="${privacy}">${e(w.privacy)}</a>${input.unsubscribeUrl ? ` &nbsp; · &nbsp; <a style="color:#405169" href="${e(input.unsubscribeUrl)}">${e(w.unsubscribe)}</a>` : ""}<br><span dir="ltr">ProviderBeacon · providerbeacon.com</span></td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}
