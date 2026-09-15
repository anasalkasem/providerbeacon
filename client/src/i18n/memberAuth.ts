import { useLocale, type Locale } from "@/contexts/LocaleContext";

const en = {
  signIn: "Sign in",
  signUp: "Create account",
  account: "My account",
  welcome: "Welcome back",
  join: "Your ProviderBeacon account",
  intro: "Compare providers with clearer prices and independent information.",
  browse: "You can browse and compare without an account.",
  google: "Continue with Google",
  googleOff:
    "Google sign-in is not available yet. You can use email and password.",
  or: "or use your email",
  name: "Your name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  passwordHint: "Use a passphrase of 15–128 characters.",
  show: "Show password",
  hide: "Hide password",
  haveAccount: "Already have an account?",
  noAccount: "New to ProviderBeacon?",
  privacy: "Privacy",
  privacyHint: "Read how we use your account information.",
  recover: "Recover account",
  recoveryIntro:
    "Use the recovery code you saved when creating your account. This signs out all devices and removes the Google connection; you can link it again afterward.",
  recoveryCode: "Recovery code",
  recoveryTitle: "Save your recovery code",
  recoveryBody:
    "Keep this backup code in a safe place. It is shown only now and replaces any previous code. It lets you recover access if you cannot sign in.",
  savedCode: "I have saved my recovery code",
  continue: "Continue",
  copy: "Copy code",
  copied: "Copied",
  profile: "Profile",
  save: "Save changes",
  saved: "Saved",
  unverified: "Email not verified",
  verified: "Email verified",
  emailNote:
    "Email is used to sign in. Google can verify it when you link the same email address.",
  security: "Account security",
  currentPassword: "Current password",
  proofHint: "Enter your current password to change security settings.",
  googleProof:
    "For security changes, sign in with Google again if your sign-in was more than 10 minutes ago.",
  newPassword: "New password",
  changePassword: "Save new password",
  googleLinked: "Google is connected",
  googleUnlinked: "Google is not connected",
  linkGoogle: "Link Google",
  linkHint: "Use the Google account with the same email address.",
  newRecovery: "Generate new recovery code",
  logout: "Sign out",
  logoutAll: "Sign out all devices",
  deleteAccount: "Delete my account",
  deleteConfirm:
    "Permanently delete your ProviderBeacon account and end all its sessions? This cannot be undone.",
  loading: "Loading…",
  retry: "Try again",
  mismatch: "The passwords do not match.",
  invalid: "Check the fields and use a password of 15–128 characters.",
  invalid_credentials: "The email or password is incorrect.",
  account_exists:
    "This email already has an account. Sign in with your existing method, then link Google from your account.",
  unavailable: "Sign-in is temporarily unavailable. Please try again later.",
  invalid_state:
    "This Google sign-in expired or belongs to another browser. Please start again.",
  google_failed: "Google sign-in did not finish. Please try again.",
  google_unverified: "Google has not verified this email address.",
  link_conflict:
    "Google could not be linked. Use the same email and a Google account that is not linked elsewhere.",
  reauthenticate:
    "Enter your current password, or sign in with Google again if you have no password.",
  invalid_recovery:
    "The email or recovery code is incorrect, expired, or already used.",
  rate_limited: "Too many attempts. Please wait before trying again.",
  busy: "Sign-in is busy. Please try again shortly.",
  sign_in_required: "Please sign in again.",
  origin: "Open providerbeacon.com and try again.",
  passwordChanged: "Password updated. Other devices were signed out.",
  privacyTitle: "Account privacy",
  privacyData:
    "We store your name, email, account creation date and sign-in records to operate your account. Passwords and recovery codes are stored as hashes, not readable text.",
  privacyGoogle:
    "If you choose Google, we request your name, email and Google account identifier for sign-in. We do not request access to Gmail, Drive or contacts. Google access tokens are discarded after sign-in.",
  privacyCookies:
    "A secure session cookie keeps you signed in for up to 30 days. Language preferences are stored in your browser. Security limits use short-lived, hashed identifiers to reduce abuse.",
  privacyAI:
    "When you use Beacon Assistant, your messages and relevant public catalogue information are sent to OpenAI to generate a reply. Your password and recovery code are never part of those requests. Do not put secrets in chat.",
  privacyDelete:
    "You can delete your account from My account. This removes its profile and active sessions from the live account database. Account deletion does not delete your Google account.",
  privacyUpdated: "Updated 15 September 2026",
};
type Text = Record<keyof typeof en, string>;
const ar: Text = {
  signIn: "تسجيل الدخول",
  signUp: "إنشاء حساب",
  account: "حسابي",
  welcome: "أهلًا بعودتك",
  join: "حسابك في ProviderBeacon",
  intro: "قارن المزوّدين بأسعار أوضح ومعلومات مستقلة.",
  browse: "يمكنك التصفّح والمقارنة دون إنشاء حساب.",
  google: "المتابعة باستخدام Google",
  googleOff:
    "الدخول عبر Google غير متاح بعد. يمكنك استخدام البريد وكلمة المرور.",
  or: "أو استخدم بريدك الإلكتروني",
  name: "اسمك",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  confirmPassword: "تأكيد كلمة المرور",
  passwordHint: "استخدم عبارة مرور من 15 إلى 128 حرفًا.",
  show: "إظهار كلمة المرور",
  hide: "إخفاء كلمة المرور",
  haveAccount: "لديك حساب بالفعل؟",
  noAccount: "جديد في ProviderBeacon؟",
  privacy: "الخصوصية",
  privacyHint: "اطّلع على كيفية استخدام معلومات حسابك.",
  recover: "استعادة الحساب",
  recoveryIntro:
    "استخدم رمز الاستعادة الذي حفظته عند إنشاء حسابك. ستُسجَّل جميع الأجهزة خارج الحساب ويُلغى ربط Google؛ يمكنك ربطه مجددًا لاحقًا.",
  recoveryCode: "رمز الاستعادة",
  recoveryTitle: "احفظ رمز استعادة حسابك",
  recoveryBody:
    "احتفظ بهذا الرمز الاحتياطي في مكان آمن. يظهر الآن فقط ويحلّ محل أي رمز سابق، ويمكنك استخدامه لاستعادة الوصول إذا تعذّر تسجيل الدخول.",
  savedCode: "حفظت رمز الاستعادة",
  continue: "متابعة",
  copy: "نسخ الرمز",
  copied: "تم النسخ",
  profile: "الملف الشخصي",
  save: "حفظ التغييرات",
  saved: "تم الحفظ",
  unverified: "البريد غير مؤكّد",
  verified: "البريد مؤكّد",
  emailNote:
    "يُستخدم البريد لتسجيل الدخول. يمكن تأكيده عند ربط حساب Google بالبريد نفسه.",
  security: "أمان الحساب",
  currentPassword: "كلمة المرور الحالية",
  proofHint: "أدخل كلمة المرور الحالية لتغيير إعدادات الأمان.",
  googleProof:
    "لتغيير إعدادات الأمان، سجّل الدخول عبر Google مجددًا إذا مرّ أكثر من 10 دقائق على دخولك.",
  newPassword: "كلمة المرور الجديدة",
  changePassword: "حفظ كلمة المرور الجديدة",
  googleLinked: "حساب Google مرتبط",
  googleUnlinked: "حساب Google غير مرتبط",
  linkGoogle: "ربط Google",
  linkHint: "استخدم حساب Google الذي يحمل البريد نفسه.",
  newRecovery: "إنشاء رمز استعادة جديد",
  logout: "تسجيل الخروج",
  logoutAll: "تسجيل الخروج من جميع الأجهزة",
  deleteAccount: "حذف حسابي",
  deleteConfirm:
    "هل تريد حذف حسابك في ProviderBeacon نهائيًا وإنهاء جميع جلساته؟ لا يمكن التراجع عن الحذف.",
  loading: "جارٍ التحميل…",
  retry: "إعادة المحاولة",
  mismatch: "كلمتا المرور غير متطابقتين.",
  invalid: "تحقّق من الحقول واستخدم كلمة مرور من 15 إلى 128 حرفًا.",
  invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  account_exists:
    "يوجد حساب بهذا البريد. ادخل بالطريقة التي استخدمتها سابقًا، ثم اربط Google من صفحة حسابك.",
  unavailable: "تسجيل الدخول غير متاح مؤقتًا. حاول لاحقًا.",
  invalid_state:
    "انتهت محاولة الدخول عبر Google أو أنها تخص متصفّحًا آخر. ابدأ مجددًا.",
  google_failed: "لم يكتمل الدخول عبر Google. حاول مجددًا.",
  google_unverified: "لم يؤكّد Google هذا البريد الإلكتروني.",
  link_conflict:
    "تعذّر ربط Google. استخدم البريد نفسه وحساب Google غير مرتبط بحساب آخر.",
  reauthenticate:
    "أدخل كلمة المرور الحالية، أو ادخل عبر Google مجددًا إذا لم تكن لديك كلمة مرور.",
  invalid_recovery:
    "البريد أو رمز الاستعادة غير صحيح، أو الرمز ملغى أو استُخدم سابقًا.",
  rate_limited: "محاولات كثيرة. انتظر قليلًا قبل المحاولة مجددًا.",
  busy: "تسجيل الدخول مشغول الآن. حاول بعد قليل.",
  sign_in_required: "يرجى تسجيل الدخول مجددًا.",
  origin: "افتح providerbeacon.com وحاول مجددًا.",
  passwordChanged: "تغيّرت كلمة المرور وسُجِّلت الأجهزة الأخرى خارج الحساب.",
  privacyTitle: "خصوصية الحساب",
  privacyData:
    "نخزّن الاسم والبريد وتاريخ إنشاء الحساب وسجلات الدخول لتشغيل حسابك. تُخزّن كلمات المرور ورموز الاستعادة بصيغة تجزئة، وليست نصوصًا مقروءة.",
  privacyGoogle:
    "عند اختيار Google، نطلب الاسم والبريد ومعرّف الحساب لتسجيل الدخول. لا نطلب الوصول إلى Gmail أو Drive أو جهات الاتصال. نتخلّص من رموز وصول Google بعد التحقّق من الدخول.",
  privacyCookies:
    "يحافظ ملف ارتباط آمن على دخولك لمدة تصل إلى 30 يومًا. تُحفظ اللغة في متصفّحك. تستخدم ضوابط الأمان معرّفات مجزّأة ومؤقتة للحدّ من إساءة الاستخدام.",
  privacyAI:
    "عند استخدام مساعد Beacon، تُرسل رسائلك ومعلومات الكتالوج العامة ذات الصلة إلى OpenAI لتوليد الرد. لا تُضمّن كلمة مرورك أو رمز الاستعادة في هذه الطلبات. لا تكتب أسرارًا في المحادثة.",
  privacyDelete:
    "يمكنك حذف حسابك من صفحة حسابي. يزيل ذلك ملفّه وجلساته النشطة من قاعدة بيانات الحسابات المستخدمة في الموقع. حذف حساب المنصة لا يحذف حساب Google.",
  privacyUpdated: "آخر تحديث: 15 سبتمبر 2026",
};
const es: Text = {
  signIn: "Iniciar sesión",
  signUp: "Crear cuenta",
  account: "Mi cuenta",
  welcome: "Te damos la bienvenida",
  join: "Tu cuenta de ProviderBeacon",
  intro:
    "Compara proveedores con precios más claros e información independiente.",
  browse: "Puedes explorar y comparar sin crear una cuenta.",
  google: "Continuar con Google",
  googleOff:
    "El acceso con Google aún no está disponible. Puedes usar tu correo y contraseña.",
  or: "o usa tu correo",
  name: "Tu nombre",
  email: "Correo electrónico",
  password: "Contraseña",
  confirmPassword: "Confirmar contraseña",
  passwordHint: "Usa una frase de contraseña de 15 a 128 caracteres.",
  show: "Mostrar contraseña",
  hide: "Ocultar contraseña",
  haveAccount: "¿Ya tienes una cuenta?",
  noAccount: "¿Primera vez en ProviderBeacon?",
  privacy: "Privacidad",
  privacyHint: "Consulta cómo usamos los datos de tu cuenta.",
  recover: "Recuperar cuenta",
  recoveryIntro:
    "Usa el código de recuperación que guardaste al crear tu cuenta. Se cerrarán todas las sesiones y se desvinculará Google; podrás volver a vincularlo después.",
  recoveryCode: "Código de recuperación",
  recoveryTitle: "Guarda tu código de recuperación",
  recoveryBody:
    "Guarda este código de respaldo en un lugar seguro. Solo se muestra ahora y sustituye cualquier código anterior. Permite recuperar el acceso si no puedes iniciar sesión.",
  savedCode: "He guardado mi código",
  continue: "Continuar",
  copy: "Copiar código",
  copied: "Copiado",
  profile: "Perfil",
  save: "Guardar cambios",
  saved: "Guardado",
  unverified: "Correo sin verificar",
  verified: "Correo verificado",
  emailNote:
    "Usas este correo para entrar. Google puede verificarlo al vincular una cuenta con el mismo correo.",
  security: "Seguridad de la cuenta",
  currentPassword: "Contraseña actual",
  proofHint:
    "Introduce tu contraseña actual para cambiar los ajustes de seguridad.",
  googleProof:
    "Para cambiar la seguridad, vuelve a entrar con Google si han pasado más de 10 minutos desde tu acceso.",
  newPassword: "Nueva contraseña",
  changePassword: "Guardar nueva contraseña",
  googleLinked: "Google está conectado",
  googleUnlinked: "Google no está conectado",
  linkGoogle: "Vincular Google",
  linkHint: "Usa una cuenta de Google con el mismo correo.",
  newRecovery: "Generar nuevo código de recuperación",
  logout: "Cerrar sesión",
  logoutAll: "Cerrar todas las sesiones",
  deleteAccount: "Eliminar mi cuenta",
  deleteConfirm:
    "¿Eliminar tu cuenta de ProviderBeacon y cerrar todas sus sesiones de forma permanente? No se puede deshacer.",
  loading: "Cargando…",
  retry: "Reintentar",
  mismatch: "Las contraseñas no coinciden.",
  invalid: "Revisa los campos y usa una contraseña de 15 a 128 caracteres.",
  invalid_credentials: "El correo o la contraseña no son correctos.",
  account_exists:
    "Ya existe una cuenta con este correo. Entra con tu método habitual y vincula Google desde tu cuenta.",
  unavailable:
    "El acceso no está disponible temporalmente. Inténtalo más tarde.",
  invalid_state:
    "Este acceso con Google ha caducado o corresponde a otro navegador. Empieza de nuevo.",
  google_failed: "No se completó el acceso con Google. Inténtalo de nuevo.",
  google_unverified: "Google no ha verificado este correo.",
  link_conflict:
    "No se pudo vincular Google. Usa el mismo correo y una cuenta de Google que no esté vinculada a otra cuenta.",
  reauthenticate:
    "Introduce tu contraseña actual o vuelve a entrar con Google si no tienes contraseña.",
  invalid_recovery:
    "El correo o el código es incorrecto, ha caducado o ya se ha usado.",
  rate_limited: "Demasiados intentos. Espera antes de volver a intentarlo.",
  busy: "El servicio está ocupado. Inténtalo en breve.",
  sign_in_required: "Vuelve a iniciar sesión.",
  origin: "Abre providerbeacon.com e inténtalo de nuevo.",
  passwordChanged: "Contraseña actualizada. Se cerraron las demás sesiones.",
  privacyTitle: "Privacidad de la cuenta",
  privacyData:
    "Guardamos tu nombre, correo, fecha de creación y registros de acceso para gestionar tu cuenta. Las contraseñas y los códigos de recuperación se guardan como hashes, no como texto legible.",
  privacyGoogle:
    "Si eliges Google, solicitamos tu nombre, correo e identificador de cuenta para acceder. No solicitamos acceso a Gmail, Drive ni contactos. Los tokens de acceso de Google se descartan después de verificar el acceso.",
  privacyCookies:
    "Una cookie segura mantiene tu sesión hasta 30 días. El idioma se guarda en tu navegador. Los límites de seguridad usan identificadores temporales con hash para reducir abusos.",
  privacyAI:
    "Cuando usas Beacon Assistant, tus mensajes y la información pública pertinente del catálogo se envían a OpenAI para generar una respuesta. Tu contraseña y código de recuperación no se incluyen en estas solicitudes. No escribas secretos en el chat.",
  privacyDelete:
    "Puedes eliminar tu cuenta desde Mi cuenta. Esto elimina su perfil y sus sesiones activas de la base de datos de cuentas en uso. No elimina tu cuenta de Google.",
  privacyUpdated: "Actualizado el 15 de septiembre de 2026",
};
const hi: Partial<Text> = {
  signIn: "साइन इन",
  signUp: "खाता बनाएँ",
  account: "मेरा खाता",
  welcome: "वापस स्वागत है",
  join: "आपका ProviderBeacon खाता",
  intro: "स्पष्ट कीमतों और स्वतंत्र जानकारी से प्रदाताओं की तुलना करें।",
  browse: "आप बिना खाते के भी तुलना कर सकते हैं।",
  google: "Google से जारी रखें",
  googleOff:
    "Google से साइन इन अभी उपलब्ध नहीं है। ईमेल और पासवर्ड इस्तेमाल करें।",
  or: "या ईमेल इस्तेमाल करें",
  name: "आपका नाम",
  email: "ईमेल",
  password: "पासवर्ड",
  confirmPassword: "पासवर्ड की पुष्टि",
  passwordHint: "15–128 अक्षरों का पासवर्ड इस्तेमाल करें।",
  show: "पासवर्ड दिखाएँ",
  hide: "पासवर्ड छिपाएँ",
  haveAccount: "पहले से खाता है?",
  noAccount: "ProviderBeacon पर नए हैं?",
  privacy: "गोपनीयता",
  recover: "खाता पुनर्प्राप्त करें",
  recoveryCode: "पुनर्प्राप्ति कोड",
  continue: "जारी रखें",
  copy: "कोड कॉपी करें",
  copied: "कॉपी हुआ",
  profile: "प्रोफ़ाइल",
  save: "सहेजें",
  saved: "सहेजा गया",
  security: "खाते की सुरक्षा",
  currentPassword: "वर्तमान पासवर्ड",
  newPassword: "नया पासवर्ड",
  changePassword: "नया पासवर्ड सहेजें",
  linkGoogle: "Google जोड़ें",
  logout: "साइन आउट",
  logoutAll: "सभी डिवाइस से साइन आउट",
  deleteAccount: "मेरा खाता मिटाएँ",
  loading: "लोड हो रहा है…",
  retry: "फिर कोशिश करें",
  mismatch: "पासवर्ड मेल नहीं खाते।",
  invalid_credentials: "ईमेल या पासवर्ड गलत है।",
};
const zh: Partial<Text> = {
  signIn: "登录",
  signUp: "创建账户",
  account: "我的账户",
  welcome: "欢迎回来",
  join: "你的 ProviderBeacon 账户",
  intro: "通过更清晰的价格和独立信息比较服务商。",
  browse: "无需账户即可浏览和比较。",
  google: "使用 Google 继续",
  googleOff: "Google 登录尚未开通。你可以使用邮箱和密码。",
  or: "或使用邮箱",
  name: "姓名",
  email: "电子邮箱",
  password: "密码",
  confirmPassword: "确认密码",
  passwordHint: "请使用 15–128 个字符的密码。",
  show: "显示密码",
  hide: "隐藏密码",
  haveAccount: "已有账户？",
  noAccount: "首次使用 ProviderBeacon？",
  privacy: "隐私",
  recover: "恢复账户",
  recoveryCode: "恢复码",
  continue: "继续",
  copy: "复制恢复码",
  copied: "已复制",
  profile: "个人资料",
  save: "保存修改",
  saved: "已保存",
  security: "账户安全",
  currentPassword: "当前密码",
  newPassword: "新密码",
  changePassword: "保存新密码",
  linkGoogle: "关联 Google",
  logout: "退出登录",
  logoutAll: "退出所有设备",
  deleteAccount: "删除我的账户",
  loading: "正在加载…",
  retry: "重试",
  mismatch: "两次密码不一致。",
  invalid_credentials: "邮箱或密码错误。",
};
Object.assign(hi, {
  privacyHint: "जानें कि आपके खाते की जानकारी कैसे इस्तेमाल होती है।",
  recoveryIntro:
    "खाता बनाते समय सहेजा गया पुनर्प्राप्ति कोड डालें। सभी डिवाइस से साइन आउट होगा और Google का लिंक हटेगा; आप बाद में उसे फिर जोड़ सकते हैं।",
  recoveryTitle: "अपना पुनर्प्राप्ति कोड सहेजें",
  recoveryBody:
    "यह बैकअप कोड सुरक्षित रखें। यह केवल अभी दिखेगा और पुराने कोड की जगह लेगा। साइन इन न कर पाने पर इससे पहुँच बहाल कर सकते हैं।",
  savedCode: "मैंने पुनर्प्राप्ति कोड सहेज लिया है",
  unverified: "ईमेल सत्यापित नहीं है",
  verified: "ईमेल सत्यापित है",
  emailNote:
    "यह ईमेल साइन इन के लिए है। इसी ईमेल वाला Google खाता जोड़कर इसे सत्यापित कर सकते हैं।",
  proofHint: "सुरक्षा सेटिंग बदलने के लिए वर्तमान पासवर्ड डालें।",
  googleProof:
    "यदि साइन इन किए 10 मिनट से अधिक हो गए हैं, तो सुरक्षा सेटिंग बदलने के लिए Google से दोबारा साइन इन करें।",
  googleLinked: "Google जुड़ा है",
  googleUnlinked: "Google नहीं जुड़ा है",
  linkHint: "इसी ईमेल वाला Google खाता इस्तेमाल करें।",
  newRecovery: "नया पुनर्प्राप्ति कोड बनाएँ",
  deleteConfirm:
    "क्या अपना ProviderBeacon खाता स्थायी रूप से मिटाकर सभी सत्र बंद करना चाहते हैं? इसे वापस नहीं किया जा सकता।",
  invalid: "जानकारी जाँचें और 15–128 अक्षरों का पासवर्ड इस्तेमाल करें।",
  account_exists:
    "इस ईमेल पर पहले से खाता है। पुराने तरीके से साइन इन करें, फिर अपने खाते से Google जोड़ें।",
  unavailable: "साइन इन अस्थायी रूप से उपलब्ध नहीं है। बाद में कोशिश करें।",
  invalid_state:
    "यह Google साइन इन समाप्त हो गया है या दूसरे ब्राउज़र का है। फिर से शुरू करें।",
  google_failed: "Google से साइन इन पूरा नहीं हुआ। फिर कोशिश करें।",
  google_unverified: "Google ने यह ईमेल सत्यापित नहीं किया है।",
  link_conflict:
    "Google नहीं जुड़ सका। इसी ईमेल का ऐसा Google खाता इस्तेमाल करें जो कहीं और न जुड़ा हो।",
  reauthenticate:
    "वर्तमान पासवर्ड डालें, या पासवर्ड न होने पर Google से फिर साइन इन करें।",
  invalid_recovery:
    "ईमेल या कोड गलत है, रद्द हो गया है या पहले इस्तेमाल हो चुका है।",
  rate_limited: "बहुत अधिक प्रयास। दोबारा कोशिश से पहले प्रतीक्षा करें।",
  busy: "साइन इन व्यस्त है। थोड़ी देर बाद कोशिश करें।",
  sign_in_required: "कृपया फिर साइन इन करें।",
  origin: "providerbeacon.com खोलकर फिर कोशिश करें।",
  passwordChanged: "पासवर्ड बदल गया है। अन्य डिवाइस से साइन आउट हो गया है।",
  privacyTitle: "खाते की गोपनीयता",
  privacyData:
    "खाता चलाने के लिए हम नाम, ईमेल, खाता बनाने की तारीख और साइन इन रिकॉर्ड रखते हैं। पासवर्ड और पुनर्प्राप्ति कोड पढ़ने योग्य पाठ के बजाय हैश के रूप में रखे जाते हैं।",
  privacyGoogle:
    "Google चुनने पर हम साइन इन के लिए नाम, ईमेल और Google खाता पहचानकर्ता माँगते हैं। Gmail, Drive या संपर्कों तक पहुँच नहीं माँगते। सत्यापन के बाद Google एक्सेस टोकन हटा दिए जाते हैं।",
  privacyCookies:
    "एक सुरक्षित कुकी आपको अधिकतम 30 दिन साइन इन रखती है। भाषा की पसंद ब्राउज़र में रहती है। दुरुपयोग रोकने के लिए अस्थायी हैश पहचानकर्ताओं का उपयोग होता है।",
  privacyAI:
    "Beacon Assistant इस्तेमाल करने पर संदेश और संबंधित सार्वजनिक कैटलॉग जानकारी उत्तर बनाने के लिए OpenAI को भेजे जाते हैं। पासवर्ड और पुनर्प्राप्ति कोड इन अनुरोधों में शामिल नहीं होते। चैट में गोपनीय जानकारी न डालें।",
  privacyDelete:
    "मेरा खाता पेज से खाता मिटा सकते हैं। इससे चालू खाता डेटाबेस से प्रोफ़ाइल और सक्रिय सत्र हटते हैं। आपका Google खाता नहीं मिटता।",
  privacyUpdated: "अद्यतन: 15 सितंबर 2026",
});
Object.assign(zh, {
  privacyHint: "了解我们如何使用你的账户信息。",
  recoveryIntro:
    "使用创建账户时保存的恢复码。这会退出所有设备并解除 Google 关联；之后可以重新关联。",
  recoveryTitle: "保存你的恢复码",
  recoveryBody:
    "请将此备用恢复码保存在安全的地方。它仅显示一次，并会替换旧码。无法登录时，可用它恢复访问。",
  savedCode: "我已保存恢复码",
  unverified: "邮箱未验证",
  verified: "邮箱已验证",
  emailNote: "此邮箱用于登录。关联相同邮箱的 Google 账户后可进行验证。",
  proofHint: "输入当前密码以修改安全设置。",
  googleProof:
    "如果上次登录已超过 10 分钟，请重新使用 Google 登录后再修改安全设置。",
  googleLinked: "已关联 Google",
  googleUnlinked: "未关联 Google",
  linkHint: "请使用邮箱相同的 Google 账户。",
  newRecovery: "生成新的恢复码",
  deleteConfirm:
    "确定永久删除你的 ProviderBeacon 账户并结束全部会话？此操作无法撤销。",
  invalid: "请检查输入内容，并使用 15–128 个字符的密码。",
  account_exists:
    "此邮箱已有账户。请使用原来的方式登录，再从账户页面关联 Google。",
  unavailable: "登录暂时不可用，请稍后重试。",
  invalid_state: "本次 Google 登录已过期或属于其他浏览器，请重新开始。",
  google_failed: "Google 登录未完成，请重试。",
  google_unverified: "Google 尚未验证此邮箱。",
  link_conflict:
    "无法关联 Google。请使用相同邮箱，且 Google 账户尚未关联其他账户。",
  reauthenticate: "请输入当前密码；如果没有密码，请重新使用 Google 登录。",
  invalid_recovery: "邮箱或恢复码错误、已失效或已使用。",
  rate_limited: "尝试次数过多，请稍后重试。",
  busy: "登录服务繁忙，请稍后重试。",
  sign_in_required: "请重新登录。",
  origin: "请打开 providerbeacon.com 后重试。",
  passwordChanged: "密码已更新，其他设备已退出。",
  privacyTitle: "账户隐私",
  privacyData:
    "我们保存姓名、邮箱、账户创建时间及登录记录，以运营你的账户。密码和恢复码以哈希形式保存，而非可读文本。",
  privacyGoogle:
    "选择 Google 时，我们请求姓名、邮箱和 Google 账户标识符用于登录，不请求 Gmail、Drive 或联系人权限。验证登录后会丢弃 Google 访问令牌。",
  privacyCookies:
    "安全 Cookie 可维持登录状态最多 30 天。语言偏好保存在浏览器中。安全限制使用短期哈希标识符来减少滥用。",
  privacyAI:
    "使用 Beacon Assistant 时，你的消息及相关公开目录信息会发送给 OpenAI 以生成回复。密码和恢复码不会包含在这些请求中。请勿在聊天中输入秘密信息。",
  privacyDelete:
    "你可以从“我的账户”删除账户。这会从正在使用的账户数据库中删除个人资料和活跃会话，但不会删除你的 Google 账户。",
  privacyUpdated: "更新于 2026 年 9 月 15 日",
});
export function memberText(locale: Locale): Text {
  return { ...en, ...{ en, ar, es, hi, zh }[locale] };
}
export function useMemberText() {
  const { locale } = useLocale();
  return memberText(locale);
}
export function memberErrorText(error: unknown, text: Text): string {
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: string })?.message ?? "");
  const key = message.replace(/^member_/, "") as keyof Text;
  const allowed = [
    "invalid_credentials",
    "account_exists",
    "unavailable",
    "invalid_state",
    "google_failed",
    "google_unverified",
    "link_conflict",
    "reauthenticate",
    "invalid_recovery",
    "rate_limited",
    "busy",
    "sign_in_required",
    "origin",
  ];
  return allowed.includes(key) ? text[key] : text.invalid;
}
