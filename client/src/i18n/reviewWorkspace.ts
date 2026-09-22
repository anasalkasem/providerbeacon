import type { Locale } from "@/contexts/LocaleContext";
const strings = {
  title: [
    "App review workspace",
    "مساحة مراجعة التطبيق",
    "Espacio de revisión",
    "ऐप समीक्षा कार्यक्षेत्र",
    "应用审核工作区",
  ],
  help: [
    "Provision ProviderBeacon Review for an existing verified member. Access is complimentary for one year and can be renewed here. The workspace and its content stay private; no payment or staff role is created.",
    "جهّز ProviderBeacon Review لحساب عضو موجود وبريد مؤكّد. الوصول مجاني لمدة سنة ويمكن تجديده هنا. تبقى المساحة ومحتوياتها خاصة، دون إنشاء دفعة مالية أو منح صلاحيات إدارة.",
    "Prepara ProviderBeacon Review para un miembro con correo verificado. El acceso gratuito dura un año y se renueva aquí. El espacio y su contenido son privados; no se crean pagos ni permisos de administración.",
    "सत्यापित सदस्य के लिए ProviderBeacon Review बनाएँ। निःशुल्क पहुँच एक वर्ष तक है और यहाँ नवीनीकृत की जा सकती है। सामग्री निजी रहती है; भुगतान या प्रशासनिक भूमिका नहीं बनाई जाती।",
    "为已验证邮箱的会员建立 ProviderBeacon Review。免费访问有效期一年，可在此续期。工作区及内容保持私密，不创建付款或管理员权限。",
  ],
  email: [
    "Verified member email",
    "بريد العضو المؤكّد",
    "Correo verificado del miembro",
    "सत्यापित सदस्य ईमेल",
    "已验证的会员邮箱",
  ],
  note: [
    "Reason for the audit log",
    "السبب في سجل الإدارة",
    "Motivo para el registro",
    "ऑडिट लॉग का कारण",
    "审计记录原因",
  ],
  confirm: [
    "I authorize a private test workspace with complimentary access.",
    "أوافق على تجهيز مساحة اختبار خاصة بوصول مجاني.",
    "Autorizo un espacio privado de pruebas con acceso gratuito.",
    "मैं निःशुल्क पहुँच वाला निजी परीक्षण कार्यक्षेत्र अधिकृत करता हूँ।",
    "我授权建立具有免费访问权限的私密测试工作区。",
  ],
  save: [
    "Create or renew review access",
    "تجهيز أو تجديد وصول المراجعة",
    "Crear o renovar acceso",
    "समीक्षा पहुँच बनाएँ या नवीनीकृत करें",
    "创建或续期审核访问",
  ],
  saved: [
    "Review workspace is ready",
    "مساحة المراجعة جاهزة",
    "El espacio está listo",
    "समीक्षा कार्यक्षेत्र तैयार है",
    "审核工作区已准备就绪",
  ],
  privateNotice: [
    "Private app review workspace — test content stays out of public listings and comparisons. The provider tools use the normal application workflows. Analytics show actual activity only.",
    "مساحة خاصة لمراجعة التطبيق — تبقى بيانات الاختبار خارج الدليل والمقارنات العامة. تستخدم أدوات المزود وظائف التطبيق المعتادة. تعرض الإحصائيات النشاط المسجّل فقط.",
    "Espacio privado de revisión: el contenido de prueba no aparece en listados ni comparaciones públicas. Las herramientas utilizan las funciones normales de la aplicación. Las estadísticas muestran solo actividad real.",
    "निजी ऐप समीक्षा कार्यक्षेत्र — परीक्षण सामग्री सार्वजनिक सूचियों और तुलनाओं में नहीं दिखती। उपकरण ऐप के सामान्य कार्यों का उपयोग करते हैं। आँकड़े केवल वास्तविक गतिविधि दिखाते हैं।",
    "私密应用审核工作区：测试内容不会出现在公开目录或比较结果中。服务商工具使用应用的正常流程。分析仅显示实际活动。",
  ],
  billing: [
    "Complimentary review access. No purchase is required and live checkout is disabled for this test workspace.",
    "وصول مجاني للمراجعة. لا يلزم الشراء، والدفع الفعلي معطّل لمساحة الاختبار هذه.",
    "Acceso gratuito para revisión. No requiere compras y el pago real está desactivado en este espacio de pruebas.",
    "निःशुल्क समीक्षा पहुँच। खरीद आवश्यक नहीं है और इस परीक्षण कार्यक्षेत्र में वास्तविक भुगतान बंद है।",
    "免费审核访问，无需购买；此测试工作区已禁用真实付款。",
  ],
  expires: [
    "Access until",
    "الوصول حتى",
    "Acceso hasta",
    "पहुँच समाप्ति",
    "访问有效期至",
  ],
  unavailable: [
    "Unable to save. Use an active account with verified email; an existing workspace cannot be reassigned to another member.",
    "تعذّر الحفظ. استخدم حسابًا نشطًا ببريد مؤكّد؛ لا يمكن نقل مساحة مرتبطة إلى عضو آخر.",
    "No se pudo guardar. Usa una cuenta activa con correo verificado; no se puede reasignar un espacio vinculado.",
    "सहेजा नहीं जा सका। सक्रिय और सत्यापित ईमेल वाला खाता उपयोग करें; जुड़े कार्यक्षेत्र को दूसरे सदस्य को नहीं सौंपा जा सकता।",
    "无法保存。请使用已验证邮箱的活跃账号；已关联的工作区不能转让给其他会员。",
  ],
} as const;
const indexes: Record<Locale, number> = { en: 0, ar: 1, es: 2, hi: 3, zh: 4 };
export const reviewWorkspaceText = (locale: Locale) =>
  Object.fromEntries(
    Object.entries(strings).map(([key, values]) => [
      key,
      values[indexes[locale]],
    ])
  ) as Record<keyof typeof strings, string>;
