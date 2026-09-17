import type { Locale } from "@/contexts/LocaleContext";
import type { SiteThemeId } from "../../../shared/siteThemes";

type ThemeCopy = {
  title: string;
  description: string;
  current: string;
  preview: string;
  previewing: string;
  apply: string;
  cancel: string;
  themes: Record<SiteThemeId, { name: string; description: string }>;
};

export const siteThemeCopy: Record<Locale, ThemeCopy> = {
  ar: {
    title: "ثيمات الموقع",
    description:
      "اختر ثيمًا لمعاينته عندك، ثم فعّله ليظهر لجميع الزوار. يمكنك العودة لأي ثيم متى أردت.",
    current: "الثيم الحالي",
    preview: "معاينة",
    previewing: "هذه معاينة عندك فقط. مظهر الموقع للزوار لم يتغيّر.",
    apply: "تفعيل الثيم",
    cancel: "العودة للثيم الحالي",
    themes: {
      fire: {
        name: "الأسود الناري",
        description: "أسود عميق، عناوين وإطارات حمراء نارية وتوهّج دافئ.",
      },
      navy: {
        name: "الأبيض والأزرق",
        description: "أبيض نقي مع عناوين وأزرار وإطارات باللون الأزرق الواضح.",
      },
      copper: {
        name: "النحاسي",
        description: "فحمي دافئ، عناوين وإطارات نحاسية وخط كلاسيكي.",
      },
      summer: {
        name: "الصيفي",
        description: "فاتح ومنعش، فيروزي ومشمشي، بطاقات مستديرة وخط عصري.",
      },
      midnight: {
        name: "الأزرق الليلي",
        description: "كحلي مع أزرق مضيء، زوايا دقيقة وخط واضح.",
      },
      pearl: {
        name: "اللؤلؤي",
        description:
          "عاجي هادئ ولمسات برونزية، خط أنيق وبطاقات بزوايا مستقيمة.",
      },
    },
  },
  en: {
    title: "Site themes",
    description:
      "Select a theme to preview it privately, then activate it for every visitor. Switch back at any time.",
    current: "Active theme",
    preview: "Preview",
    previewing:
      "Only you see this preview. Visitors still see the active theme.",
    apply: "Activate theme",
    cancel: "Return to active theme",
    themes: {
      fire: {
        name: "Fire black",
        description:
          "Deep black, fiery red headings and borders, with a warm glow.",
      },
      navy: {
        name: "White and blue",
        description:
          "Pure white with vivid blue headings, buttons and borders.",
      },
      copper: {
        name: "Copper",
        description:
          "Warm charcoal, copper headings and borders, and classic typography.",
      },
      summer: {
        name: "Summer",
        description:
          "Fresh ivory, teal and apricot, rounded cards and modern type.",
      },
      midnight: {
        name: "Midnight blue",
        description:
          "Deep navy, luminous blue, precise corners and clear type.",
      },
      pearl: {
        name: "Pearl",
        description:
          "Quiet ivory, bronze accents, elegant type and crisp cards.",
      },
    },
  },
  es: {
    title: "Temas del sitio",
    description:
      "Selecciona un tema para verlo en privado y actívalo para todos los visitantes. Puedes volver al anterior cuando quieras.",
    current: "Tema activo",
    preview: "Vista previa",
    previewing:
      "Solo tú ves esta vista previa. Los visitantes siguen viendo el tema activo.",
    apply: "Activar tema",
    cancel: "Volver al tema activo",
    themes: {
      fire: {
        name: "Negro fuego",
        description:
          "Negro profundo, títulos y bordes rojo fuego con un brillo cálido.",
      },
      navy: {
        name: "Blanco y azul",
        description:
          "Blanco puro con títulos, botones y bordes de un azul vivo.",
      },
      copper: {
        name: "Cobre",
        description:
          "Carbón cálido, títulos y bordes cobrizos, tipografía clásica.",
      },
      summer: {
        name: "Verano",
        description:
          "Tonos claros, turquesa y albaricoque, tarjetas redondeadas y letra moderna.",
      },
      midnight: {
        name: "Azul nocturno",
        description:
          "Azul marino, acentos luminosos, esquinas precisas y letra clara.",
      },
      pearl: {
        name: "Perla",
        description:
          "Marfil sereno, detalles de bronce, letra elegante y tarjetas rectas.",
      },
    },
  },
  hi: {
    title: "साइट थीम",
    description:
      "थीम का निजी पूर्वावलोकन देखें, फिर सभी आगंतुकों के लिए सक्रिय करें। कभी भी पिछली थीम पर लौट सकते हैं।",
    current: "सक्रिय थीम",
    preview: "पूर्वावलोकन",
    previewing:
      "यह पूर्वावलोकन केवल आपको दिखता है। आगंतुक अभी भी सक्रिय थीम देखते हैं।",
    apply: "थीम सक्रिय करें",
    cancel: "सक्रिय थीम पर लौटें",
    themes: {
      fire: {
        name: "अग्नि काला",
        description: "गहरा काला, आग जैसे लाल शीर्षक और किनारे, हल्की गर्म चमक।",
      },
      navy: {
        name: "सफ़ेद और नीला",
        description: "शुद्ध सफ़ेद, चमकीले नीले शीर्षक, बटन और किनारे।",
      },
      copper: {
        name: "तांबा",
        description: "गहरा चारकोल, तांबे के शीर्षक और किनारे, क्लासिक अक्षर।",
      },
      summer: {
        name: "ग्रीष्म",
        description:
          "हल्के रंग, फ़िरोज़ी और खुबानी, गोल कार्ड और आधुनिक अक्षर।",
      },
      midnight: {
        name: "रात्रि नीला",
        description: "गहरा नीला, चमकते संकेत, सटीक कोने और स्पष्ट अक्षर।",
      },
      pearl: {
        name: "मोती",
        description:
          "शांत हाथीदांत, कांस्य के संकेत, सुंदर अक्षर और सीधे कार्ड।",
      },
    },
  },
  zh: {
    title: "网站主题",
    description:
      "选择主题进行私人预览，然后为所有访客启用。你可以随时切换回来。",
    current: "当前主题",
    preview: "预览",
    previewing: "只有你能看到此预览。访客仍然看到当前主题。",
    apply: "启用主题",
    cancel: "返回当前主题",
    themes: {
      fire: {
        name: "烈焰黑",
        description: "深黑底色、火红标题与边框，搭配温暖光晕。",
      },
      navy: {
        name: "纯白亮蓝",
        description: "纯白底色，搭配鲜明的蓝色标题、按钮和边框。",
      },
      copper: {
        name: "暖铜",
        description: "温暖炭灰、铜色标题与边框，搭配经典字体。",
      },
      summer: {
        name: "夏日",
        description: "清新浅色、青绿与杏色、圆润卡片和现代字体。",
      },
      midnight: {
        name: "午夜蓝",
        description: "深海军蓝、明亮蓝色、利落边角与清晰字体。",
      },
      pearl: {
        name: "珍珠",
        description: "宁静象牙白、青铜点缀、优雅字体与简洁卡片。",
      },
    },
  },
};
