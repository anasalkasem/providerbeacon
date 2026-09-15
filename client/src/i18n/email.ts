import { useLocale } from "@/contexts/LocaleContext";
const en = {
  preferences: "Email preferences",
  consent:
    "I would like to receive ProviderBeacon news and offers by email. I can unsubscribe at any time.",
  language: "Email language",
  save: "Save preferences",
  saved: "Your preferences have been saved.",
  verify: "Confirm your email",
  sendVerification: "Send confirmation email",
  queued:
    "Your email request is queued. Please check your inbox and spam folder shortly.",
  forgot: "Forgot your password?",
  email: "Email address",
  request: "Send reset link",
  generic:
    "If an active account uses this email, a reset link will arrive shortly. Check your spam folder too.",
  reset: "Choose a new password",
  password: "New password (at least 15 characters)",
  confirmPassword: "Confirm new password",
  mismatch: "The passwords do not match.",
  continue: "Continue",
  verified: "Your email is confirmed.",
  resetDone:
    "Your password has been reset. Sign in again. Previous sessions and recovery codes are no longer valid.",
  signIn: "Sign in",
  unavailable: "Email delivery is being set up. Please try again later.",
  error:
    "This link is invalid, expired or already used. Request a new link and try again.",
  requestError:
    "The request could not be completed. Please wait and try again.",
  unsub: "Unsubscribe from updates",
  unsubBody:
    "You will stop receiving news and offers. Essential account and security emails will continue.",
  unsubDone: "You have unsubscribed from news and offers.",
  account: "My account",
  recovery: "Use a recovery code",
  privacy:
    "We use Resend to deliver welcome, verification, password reset and account emails. Email language and optional marketing consent are stored with your account. News and offers require your subscription; you can unsubscribe in every update or in your account. We record delivery outcomes, not email opens or clicks. Encrypted message content is cleared after delivery submission or final failure; email logs are retained for up to 90 days. A hashed suppression record is retained to prevent further delivery after a bounce or complaint. Contact: soporte@providerbeacon.com.",
};
type Copy = typeof en;
const ar: Copy = {
  preferences: "تفضيلات البريد الإلكتروني",
  consent:
    "أرغب في تلقي أخبار ProviderBeacon وعروضه عبر البريد، ويمكنني إلغاء الاشتراك في أي وقت.",
  language: "لغة الرسائل",
  save: "حفظ التفضيلات",
  saved: "تم حفظ تفضيلاتك.",
  verify: "تأكيد بريدك الإلكتروني",
  sendVerification: "إرسال رسالة التأكيد",
  queued:
    "أُضيف طلب الرسالة إلى قائمة الإرسال. تفقّد بريدك ومجلد الرسائل غير المرغوب فيها بعد قليل.",
  forgot: "نسيت كلمة المرور؟",
  email: "البريد الإلكتروني",
  request: "إرسال رابط الاستعادة",
  generic:
    "إذا كان هذا البريد مرتبطًا بحساب نشط، فسيصلك رابط الاستعادة قريبًا. تفقّد الرسائل غير المرغوب فيها أيضًا.",
  reset: "اختر كلمة مرور جديدة",
  password: "كلمة مرور جديدة (15 حرفًا على الأقل)",
  confirmPassword: "تأكيد كلمة المرور الجديدة",
  mismatch: "كلمتا المرور غير متطابقتين.",
  continue: "متابعة",
  verified: "تم تأكيد بريدك الإلكتروني.",
  resetDone:
    "تم تعيين كلمة المرور. سجّل دخولك مجددًا؛ أُلغيت الجلسات ورموز الاستعادة السابقة.",
  signIn: "تسجيل الدخول",
  unavailable: "جارٍ تجهيز الإرسال عبر البريد. حاول مجددًا لاحقًا.",
  error:
    "الرابط غير صالح أو انتهت صلاحيته أو استُخدم سابقًا. اطلب رابطًا جديدًا.",
  requestError: "تعذّر إكمال الطلب. انتظر قليلًا وحاول مجددًا.",
  unsub: "إلغاء الاشتراك في التحديثات",
  unsubBody:
    "ستتوقف رسائل الأخبار والعروض. ستستمر رسائل الحساب والأمان الضرورية.",
  unsubDone: "تم إلغاء اشتراكك في الأخبار والعروض.",
  account: "حسابي",
  recovery: "استخدام رمز الاستعادة",
  privacy:
    "نستخدم Resend لإرسال رسائل الترحيب وتأكيد البريد واستعادة كلمة المرور ورسائل الحساب. نحفظ لغة الرسائل وموافقتك الاختيارية على التسويق ضمن حسابك. الأخبار والعروض تتطلب اشتراكك، ويمكن إلغاؤه من الرسائل أو الحساب. نسجّل حالة التسليم دون تتبّع فتح الرسائل أو النقرات. يُمسح محتوى الرسائل المشفّر بعد قبول الإرسال أو فشله نهائيًا، وتُحفظ سجلات البريد لمدة تصل إلى 90 يومًا. نحتفظ ببصمة مشفّرة للعنوان لمنع الإرسال بعد ارتداد الرسائل أو الشكاوى. للتواصل: soporte@providerbeacon.com.",
};
const es: Copy = {
  preferences: "Preferencias de correo",
  consent:
    "Quiero recibir novedades y ofertas de ProviderBeacon por correo. Puedo cancelar la suscripción en cualquier momento.",
  language: "Idioma del correo",
  save: "Guardar preferencias",
  saved: "Tus preferencias se han guardado.",
  verify: "Confirma tu correo",
  sendVerification: "Enviar correo de confirmación",
  queued:
    "La solicitud de correo está en cola. Revisa pronto tu bandeja de entrada y la carpeta de spam.",
  forgot: "¿Olvidaste tu contraseña?",
  email: "Correo electrónico",
  request: "Enviar enlace",
  generic:
    "Si este correo corresponde a una cuenta activa, recibirás un enlace en breve. Revisa también la carpeta de spam.",
  reset: "Elige una contraseña nueva",
  password: "Contraseña nueva (al menos 15 caracteres)",
  confirmPassword: "Repite la contraseña nueva",
  mismatch: "Las contraseñas no coinciden.",
  continue: "Continuar",
  verified: "Tu correo está confirmado.",
  resetDone:
    "Tu contraseña se ha restablecido. Inicia sesión de nuevo. Las sesiones y los códigos de recuperación anteriores ya no son válidos.",
  signIn: "Iniciar sesión",
  unavailable: "Estamos configurando el envío de correos. Inténtalo más tarde.",
  error:
    "Este enlace no es válido, ha caducado o ya se ha usado. Solicita otro enlace.",
  requestError:
    "No se pudo completar la solicitud. Espera e inténtalo de nuevo.",
  unsub: "Cancelar suscripción a novedades",
  unsubBody:
    "Dejarás de recibir novedades y ofertas. Seguirás recibiendo los mensajes esenciales de cuenta y seguridad.",
  unsubDone: "Has cancelado tu suscripción a novedades y ofertas.",
  account: "Mi cuenta",
  recovery: "Usar un código de recuperación",
  privacy:
    "Usamos Resend para enviar correos de bienvenida, verificación, recuperación de contraseña y de cuenta. Guardamos el idioma y el consentimiento opcional para marketing. Las novedades y ofertas requieren tu suscripción, que puedes cancelar desde los correos o tu cuenta. Registramos resultados de entrega, sin rastrear aperturas ni clics. El contenido cifrado se elimina al aceptar el envío o tras un fallo definitivo; los registros se conservan hasta 90 días. Conservamos una huella del correo para impedir nuevos envíos tras rebotes o quejas. Contacto: soporte@providerbeacon.com.",
};
const hi: Copy = {
  ...en,
  preferences: "ईमेल प्राथमिकताएँ",
  consent:
    "मैं ProviderBeacon की खबरें और ऑफ़र ईमेल से प्राप्त करना चाहता हूँ। मैं कभी भी सदस्यता समाप्त कर सकता हूँ।",
  language: "ईमेल की भाषा",
  save: "प्राथमिकताएँ सहेजें",
  saved: "आपकी प्राथमिकताएँ सहेज दी गई हैं।",
  verify: "अपना ईमेल सत्यापित करें",
  sendVerification: "सत्यापन ईमेल भेजें",
  queued: "ईमेल अनुरोध कतार में है। अपना इनबॉक्स और स्पैम फ़ोल्डर देखें।",
  forgot: "पासवर्ड भूल गए?",
  email: "ईमेल पता",
  request: "रीसेट लिंक भेजें",
  generic:
    "यदि इस ईमेल से कोई सक्रिय खाता जुड़ा है, तो जल्द ही रीसेट लिंक मिलेगा। स्पैम फ़ोल्डर भी देखें।",
  reset: "नया पासवर्ड चुनें",
  password: "नया पासवर्ड (कम से कम 15 अक्षर)",
  confirmPassword: "नए पासवर्ड की पुष्टि करें",
  mismatch: "पासवर्ड मेल नहीं खाते।",
  continue: "जारी रखें",
  verified: "आपका ईमेल सत्यापित हो गया है।",
  resetDone:
    "पासवर्ड रीसेट हो गया है। फिर से साइन इन करें। पुराने सत्र और पुनर्प्राप्ति कोड अमान्य हैं।",
  signIn: "साइन इन करें",
  unavailable: "ईमेल सेवा तैयार की जा रही है। बाद में फिर कोशिश करें।",
  error:
    "लिंक अमान्य है, समाप्त हो गया है या इस्तेमाल हो चुका है। नया लिंक माँगें।",
  requestError: "अनुरोध पूरा नहीं हुआ। थोड़ी देर बाद फिर कोशिश करें।",
  unsub: "अपडेट की सदस्यता समाप्त करें",
  unsubBody:
    "खबरें और ऑफ़र बंद हो जाएँगे। ज़रूरी खाता और सुरक्षा ईमेल जारी रहेंगे।",
  unsubDone: "आपकी खबरों और ऑफ़र की सदस्यता समाप्त कर दी गई है।",
  account: "मेरा खाता",
  recovery: "पुनर्प्राप्ति कोड इस्तेमाल करें",
};
const zh: Copy = {
  ...en,
  preferences: "邮件偏好",
  consent: "我愿意通过邮件接收 ProviderBeacon 的新闻和优惠，并可随时取消订阅。",
  language: "邮件语言",
  save: "保存偏好",
  saved: "您的偏好已保存。",
  verify: "验证邮箱",
  sendVerification: "发送验证邮件",
  queued: "邮件请求已加入队列。请稍后查看收件箱及垃圾邮件文件夹。",
  forgot: "忘记密码？",
  email: "邮箱地址",
  request: "发送重置链接",
  generic: "如果此邮箱关联了有效账户，您将很快收到重置链接。也请检查垃圾邮件。",
  reset: "设置新密码",
  password: "新密码（至少15个字符）",
  confirmPassword: "确认新密码",
  mismatch: "两次密码不一致。",
  continue: "继续",
  verified: "您的邮箱已验证。",
  resetDone: "密码已重置，请重新登录。之前的登录会话和恢复码均已失效。",
  signIn: "登录",
  unavailable: "邮件服务正在配置中，请稍后重试。",
  error: "链接无效、已过期或已使用，请申请新链接。",
  requestError: "无法完成请求，请稍后重试。",
  unsub: "取消订阅更新",
  unsubBody: "您将不再收到新闻和优惠，但仍会收到必要的账户和安全邮件。",
  unsubDone: "您已取消订阅新闻和优惠。",
  account: "我的账户",
  recovery: "使用恢复码",
};
export function useEmailText() {
  const { locale } = useLocale();
  return { en, ar, es, hi, zh }[locale] ?? en;
}
