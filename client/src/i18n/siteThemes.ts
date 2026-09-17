import type { Locale } from "@/contexts/LocaleContext";

const en = {
  current: "Active theme",
  scope:
    "Preview either design, then activate it for all visitors. Only the owner can change the published theme.",
  apply: "Activate theme",
  preview: "Preview website",
  previewBanner: "Theme preview · only in this tab",
  leavePreview: "Exit preview",
  themes: {
    beacon: {
      name: "Beacon Classic",
      description:
        "The original black, white and electric blue design, with clear borders and a centered search.",
    },
    orbit: {
      name: "Beacon Orbit 3D",
      description:
        "A three-dimensional beacon, moving constellations and violet accents on a spacious black canvas. Motion can be paused.",
    },
  },
  hero: {
    eyebrow: "YOUR SIGNAL IN A WORLD OF PROVIDERS",
    title: "Find your signal.",
    accent: "Choose your provider.",
    intro:
      "Tell us what you need. Explore real provider offers, understand their terms and compare your options in one place.",
    caption: "A clearer connection to the services you need.",
    sceneLabel:
      "A three-dimensional beacon surrounded by orbiting points of light",
    pause: "Pause motion",
    resume: "Play motion",
    reduced: "Reduced motion enabled",
  },
};
export const siteThemeCopy: Record<Locale, typeof en> = {
  en,
  ar: {
    current: "الثيم المفعّل",
    scope:
      "عاين التصميم، ثم فعّله لجميع الزوار. تغيير الثيم المنشور متاح للمالك فقط.",
    apply: "تفعيل الثيم",
    preview: "معاينة الموقع",
    previewBanner: "معاينة الثيم · في هذه النافذة فقط",
    leavePreview: "إنهاء المعاينة",
    themes: {
      beacon: {
        name: "Beacon Classic · الأزرق",
        description:
          "التصميم الأساسي بالأسود والأبيض والأزرق، مع إطارات واضحة وبحث في منتصف الصفحة.",
      },
      orbit: {
        name: "Beacon Orbit 3D · المدار",
        description:
          "منارة ثلاثية الأبعاد، خلفية نجوم متحركة ولمسات بنفسجية على مساحة سوداء واسعة. مع إمكانية إيقاف الحركة.",
      },
    },
    hero: {
      eyebrow: "منارتك في عالم المزوّدين",
      title: "وسط كل الخيارات،",
      accent: "اعثر على مزوّدك.",
      intro:
        "احكِ لنا شو تحتاج. استكشف عروض المزوّدين الفعلية، وافهم شروطها، وقارن خياراتك بمكان واحد.",
      caption: "من طلبك، إلى الخدمة التي تبحث عنها.",
      sceneLabel: "منارة ثلاثية الأبعاد تحيط بها نقاط ضوئية في مدارات متحركة",
      pause: "إيقاف الحركة",
      resume: "تشغيل الحركة",
      reduced: "تقليل الحركة مفعّل",
    },
  },
  es: {
    current: "Tema activo",
    scope:
      "Previsualiza el diseño y actívalo para todos. Solo el propietario puede cambiar el tema publicado.",
    apply: "Activar tema",
    preview: "Ver vista previa",
    previewBanner: "Vista previa · solo en esta pestaña",
    leavePreview: "Salir de la vista previa",
    themes: {
      beacon: {
        name: "Beacon Classic",
        description:
          "El diseño original en negro, blanco y azul, con bordes definidos y búsqueda centrada.",
      },
      orbit: {
        name: "Beacon Orbit 3D",
        description:
          "Un faro tridimensional, constelaciones en movimiento y acentos violetas sobre negro. Animación con pausa.",
      },
    },
    hero: {
      eyebrow: "TU GUÍA ENTRE PROVEEDORES",
      title: "Entre tantas opciones,",
      accent: "encuentra tu proveedor.",
      intro:
        "Dinos qué necesitas. Descubre ofertas reales, entiende sus condiciones y compara tus opciones en un solo lugar.",
      caption: "Una conexión más clara con los servicios que buscas.",
      sceneLabel: "Un faro tridimensional rodeado de puntos de luz en órbita",
      pause: "Pausar animación",
      resume: "Reanudar animación",
      reduced: "Movimiento reducido activado",
    },
  },
  hi: {
    current: "सक्रिय थीम",
    scope:
      "डिज़ाइन का पूर्वावलोकन करें, फिर सभी के लिए सक्रिय करें। केवल मालिक प्रकाशित थीम बदल सकता है।",
    apply: "थीम सक्रिय करें",
    preview: "वेबसाइट का पूर्वावलोकन",
    previewBanner: "थीम पूर्वावलोकन · केवल इस टैब में",
    leavePreview: "पूर्वावलोकन बंद करें",
    themes: {
      beacon: {
        name: "Beacon Classic",
        description:
          "काला, सफ़ेद और नीला मूल डिज़ाइन, स्पष्ट बॉर्डर और बीच में खोज।",
      },
      orbit: {
        name: "Beacon Orbit 3D",
        description:
          "त्रि-आयामी प्रकाश स्तंभ, गतिशील तारामंडल और काले रंग पर बैंगनी संकेत। गति रोकी जा सकती है।",
      },
    },
    hero: {
      eyebrow: "प्रदाताओं की दुनिया में आपका मार्गदर्शक",
      title: "अपने विकल्प जानें।",
      accent: "अपना प्रदाता चुनें।",
      intro:
        "हमें अपनी ज़रूरत बताएँ। वास्तविक ऑफ़र खोजें, शर्तें समझें और एक ही जगह विकल्पों की तुलना करें।",
      caption: "आपकी ज़रूरत से सही सेवा तक।",
      sceneLabel: "त्रि-आयामी प्रकाश स्तंभ के चारों ओर घूमते प्रकाश बिंदु",
      pause: "गति रोकें",
      resume: "गति चालू करें",
      reduced: "कम गति सक्षम है",
    },
  },
  zh: {
    current: "当前主题",
    scope: "预览设计，再为所有访客启用。只有所有者可以更改已发布的主题。",
    apply: "启用主题",
    preview: "预览网站",
    previewBanner: "主题预览 · 仅限当前标签页",
    leavePreview: "退出预览",
    themes: {
      beacon: {
        name: "Beacon Classic",
        description: "黑白蓝经典设计，清晰的边框和居中的搜索栏。",
      },
      orbit: {
        name: "Beacon Orbit 3D",
        description: "三维灯塔、动态星群，搭配黑色画布和紫色点缀。动画可暂停。",
      },
    },
    hero: {
      eyebrow: "服务商世界中的指引",
      title: "看清所有选择。",
      accent: "找到你的服务商。",
      intro: "告诉我们你的需求。探索真实报价，了解条款，在同一个地方比较选项。",
      caption: "从你的需求，连接到所需的服务。",
      sceneLabel: "三维灯塔周围环绕着轨道光点",
      pause: "暂停动画",
      resume: "播放动画",
      reduced: "已启用减少动态效果",
    },
  },
};
