import type { Locale } from "@/contexts/LocaleContext";

const en = {
  home: "Home",
  search: "Search",
  compare: "Compare",
  saved: "Saved",
  account: "Account",
  navigation: "Mobile navigation",
  install: "Install app",
  title: "ProviderBeacon, one tap away.",
  intro:
    "Search providers, compare offers and return to your saved services from your home screen.",
  sameAccount:
    "Use your existing ProviderBeacon account. Your saved services and comparisons stay in sync.",
  onlineRequired:
    "Search, current prices and Beacon AI need an internet connection.",
  installing: "Opening installation…",
  installed: "App installed",
  installedBody:
    "ProviderBeacon is ready to open from your home screen or app launcher.",
  accepted:
    "Installation accepted. Complete any remaining steps shown by your browser.",
  installError:
    "Installation did not open. Follow the browser steps below, or try again.",
  manual: "Install from your browser",
  iosOne: "Open this page in Safari, then open the Share menu.",
  iosTwo: "Choose Add to Home Screen. If shown, enable Open as Web App.",
  iosThree: "Tap Add, then open ProviderBeacon from its new icon.",
  androidOne: "Open this page in Chrome or Samsung Internet.",
  androidTwo:
    "Open the browser menu and choose Install app or Add to Home screen.",
  androidThree: "Confirm, then open ProviderBeacon from its icon.",
  desktopOne:
    "In Chrome or Edge, use the install icon in the address bar or the browser menu.",
  desktopTwo: "In Safari on Mac, choose File, then Add to Dock.",
  fallback:
    "If your browser has no installation option, open this page in a supported browser. You can keep using the website normally.",
  start: "Start searching",
  how: "How to install",
  offline:
    "You're offline. Reconnect to refresh prices, search and send messages.",
  update: "An app update is ready.",
  updateBody: "Finish your current work before reloading.",
  reload: "Update and reload",
  later: "Later",
};
type Copy = { [K in keyof typeof en]: string };
export const mobileAppCopy: Record<Locale, Copy> = {
  en,
  ar: {
    home: "الرئيسية",
    search: "البحث",
    compare: "المقارنة",
    saved: "المحفوظات",
    account: "حسابي",
    navigation: "التنقّل على الهاتف",
    install: "تثبيت التطبيق",
    title: "ProviderBeacon، بلمسة واحدة.",
    intro:
      "ابحث عن المزوّدين، قارن العروض وارجع لخدماتك المحفوظة من شاشة هاتفك الرئيسية.",
    sameAccount:
      "استخدم حسابك الحالي في ProviderBeacon. خدماتك ومقارناتك المحفوظة مرتبطة بنفس الحساب.",
    onlineRequired:
      "البحث والأسعار الحالية ومساعد Beacon تحتاج اتصالًا بالإنترنت.",
    installing: "جارٍ فتح التثبيت…",
    installed: "التطبيق مثبّت",
    installedBody:
      "يمكنك فتح ProviderBeacon من أيقونته على الشاشة الرئيسية أو قائمة التطبيقات.",
    accepted: "تم قبول التثبيت. أكمل أي خطوات إضافية يعرضها المتصفح.",
    installError: "لم يفتح التثبيت. اتبع خطوات المتصفح أدناه أو حاول مجددًا.",
    manual: "التثبيت من المتصفح",
    iosOne: "افتح هذه الصفحة في Safari، ثم افتح قائمة المشاركة.",
    iosTwo:
      "اختر «إضافة إلى الشاشة الرئيسية». فعّل «فتح كتطبيق ويب» إذا ظهر الخيار.",
    iosThree: "اضغط «إضافة»، ثم افتح ProviderBeacon من الأيقونة الجديدة.",
    androidOne: "افتح هذه الصفحة في Chrome أو Samsung Internet.",
    androidTwo:
      "من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",
    androidThree: "أكّد الإضافة ثم افتح ProviderBeacon من أيقونته.",
    desktopOne:
      "في Chrome أو Edge، اضغط أيقونة التثبيت بجانب العنوان أو استخدم قائمة المتصفح.",
    desktopTwo: "في Safari على Mac، اختر «ملف» ثم «إضافة إلى Dock».",
    fallback:
      "إذا لم يظهر خيار التثبيت، افتح الصفحة في متصفح يدعمه. يمكنك متابعة استخدام الموقع كالمعتاد.",
    start: "ابدأ البحث",
    how: "طريقة التثبيت",
    offline: "أنت غير متصل. أعد الاتصال لتحديث الأسعار والبحث وإرسال الرسائل.",
    update: "تحديث جديد للتطبيق جاهز.",
    updateBody: "أكمل عملك الحالي قبل إعادة التحميل.",
    reload: "تحديث وإعادة تحميل",
    later: "لاحقًا",
  },
  es: {
    home: "Inicio",
    search: "Buscar",
    compare: "Comparar",
    saved: "Guardados",
    account: "Cuenta",
    navigation: "Navegación móvil",
    install: "Instalar app",
    title: "ProviderBeacon, a un toque.",
    intro:
      "Busca proveedores, compara ofertas y vuelve a tus servicios guardados desde la pantalla de inicio.",
    sameAccount:
      "Usa tu cuenta actual de ProviderBeacon. Tus servicios y comparaciones guardados siguen sincronizados.",
    onlineRequired:
      "La búsqueda, los precios actuales y Beacon AI necesitan conexión a internet.",
    installing: "Abriendo instalación…",
    installed: "App instalada",
    installedBody:
      "Abre ProviderBeacon desde su icono en la pantalla de inicio o en tus aplicaciones.",
    accepted:
      "Instalación aceptada. Completa los pasos adicionales que muestre el navegador.",
    installError:
      "No se abrió la instalación. Sigue los pasos de abajo o vuelve a intentarlo.",
    manual: "Instala desde tu navegador",
    iosOne: "Abre esta página en Safari y abre el menú Compartir.",
    iosTwo:
      "Elige Añadir a pantalla de inicio. Activa Abrir como app web si aparece.",
    iosThree: "Pulsa Añadir y abre ProviderBeacon desde su nuevo icono.",
    androidOne: "Abre esta página en Chrome o Samsung Internet.",
    androidTwo:
      "En el menú del navegador, elige Instalar aplicación o Añadir a pantalla de inicio.",
    androidThree: "Confirma y abre ProviderBeacon desde su icono.",
    desktopOne:
      "En Chrome o Edge, usa el icono de instalación junto a la dirección o el menú del navegador.",
    desktopTwo: "En Safari para Mac, elige Archivo y Añadir al Dock.",
    fallback:
      "Si tu navegador no ofrece instalación, abre esta página en uno compatible. Puedes seguir usando el sitio normalmente.",
    start: "Empezar a buscar",
    how: "Cómo instalar",
    offline:
      "Sin conexión. Reconecta para actualizar precios, buscar y enviar mensajes.",
    update: "Hay una actualización disponible.",
    updateBody: "Termina tu trabajo antes de recargar.",
    reload: "Actualizar y recargar",
    later: "Después",
  },
  hi: {
    home: "होम",
    search: "खोजें",
    compare: "तुलना",
    saved: "सहेजे गए",
    account: "खाता",
    navigation: "मोबाइल नेविगेशन",
    install: "ऐप इंस्टॉल करें",
    title: "ProviderBeacon, बस एक टैप पर।",
    intro:
      "अपनी होम स्क्रीन से प्रदाता खोजें, ऑफ़र की तुलना करें और सहेजी गई सेवाएँ खोलें।",
    sameAccount:
      "अपना मौजूदा ProviderBeacon खाता इस्तेमाल करें। सहेजी गई सेवाएँ और तुलनाएँ उसी खाते में रहेंगी।",
    onlineRequired:
      "खोज, वर्तमान कीमतों और Beacon AI के लिए इंटरनेट ज़रूरी है।",
    installing: "इंस्टॉलेशन खुल रहा है…",
    installed: "ऐप इंस्टॉल है",
    installedBody:
      "होम स्क्रीन या ऐप सूची में ProviderBeacon के आइकन से इसे खोलें।",
    accepted: "इंस्टॉलेशन स्वीकार हुआ। ब्राउज़र के बाकी चरण पूरे करें।",
    installError:
      "इंस्टॉलेशन नहीं खुला। नीचे दिए चरण अपनाएँ या दोबारा कोशिश करें।",
    manual: "ब्राउज़र से इंस्टॉल करें",
    iosOne: "यह पेज Safari में खोलें और शेयर मेनू खोलें।",
    iosTwo: "Add to Home Screen चुनें। दिखने पर Open as Web App चालू करें।",
    iosThree: "Add दबाएँ, फिर नए आइकन से ProviderBeacon खोलें।",
    androidOne: "यह पेज Chrome या Samsung Internet में खोलें।",
    androidTwo: "ब्राउज़र मेनू में Install app या Add to Home screen चुनें।",
    androidThree: "पुष्टि करें और आइकन से ProviderBeacon खोलें।",
    desktopOne:
      "Chrome या Edge में पता बार का इंस्टॉल आइकन या ब्राउज़र मेनू इस्तेमाल करें।",
    desktopTwo: "Mac पर Safari में File और फिर Add to Dock चुनें।",
    fallback:
      "इंस्टॉल विकल्प न दिखे तो समर्थित ब्राउज़र में खोलें। वेबसाइट सामान्य रूप से इस्तेमाल कर सकते हैं।",
    start: "खोज शुरू करें",
    how: "कैसे इंस्टॉल करें",
    offline:
      "इंटरनेट नहीं है। कीमतें अपडेट करने, खोजने और संदेश भेजने के लिए फिर कनेक्ट करें।",
    update: "ऐप अपडेट तैयार है।",
    updateBody: "रीलोड करने से पहले अपना काम पूरा करें।",
    reload: "अपडेट और रीलोड",
    later: "बाद में",
  },
  zh: {
    home: "首页",
    search: "搜索",
    compare: "比较",
    saved: "已保存",
    account: "账户",
    navigation: "移动导航",
    install: "安装应用",
    title: "轻触即达 ProviderBeacon。",
    intro: "从主屏幕搜索服务商、比较报价并查看已保存的服务。",
    sameAccount: "使用现有 ProviderBeacon 账户，已保存的服务和比较将保持同步。",
    onlineRequired: "搜索、最新价格和 Beacon AI 需要互联网连接。",
    installing: "正在打开安装…",
    installed: "应用已安装",
    installedBody: "从主屏幕或应用列表中的图标打开 ProviderBeacon。",
    accepted: "已接受安装。请完成浏览器显示的其余步骤。",
    installError: "未能打开安装。请按照下方步骤操作或重试。",
    manual: "通过浏览器安装",
    iosOne: "在 Safari 中打开此页面，然后打开分享菜单。",
    iosTwo: "选择“添加到主屏幕”。如有“作为网页应用打开”，请启用。",
    iosThree: "点击“添加”，然后通过新图标打开 ProviderBeacon。",
    androidOne: "在 Chrome 或 Samsung Internet 中打开此页面。",
    androidTwo: "在浏览器菜单中选择“安装应用”或“添加到主屏幕”。",
    androidThree: "确认后，从图标打开 ProviderBeacon。",
    desktopOne: "在 Chrome 或 Edge 中，使用地址栏的安装图标或浏览器菜单。",
    desktopTwo: "在 Mac 的 Safari 中，选择“文件”，然后选择“添加到程序坞”。",
    fallback: "如果没有安装选项，请使用支持安装的浏览器。您仍可正常使用网站。",
    start: "开始搜索",
    how: "安装方法",
    offline: "当前离线。请重新连接以更新价格、搜索和发送消息。",
    update: "应用更新已就绪。",
    updateBody: "重新加载前请完成当前操作。",
    reload: "更新并重新加载",
    later: "稍后",
  },
};
