import type { Locale } from "@/contexts/LocaleContext";

export const catalogueExperience: Record<
  Locale,
  { ads: string; adsHelp: string; offersHelp: string; compare: string }
> = {
  ar: {
    ads: "إعلانات مميزة",
    adsHelp: "مساحة ترويجية مستقلة عن ترتيب أسعار الخدمات.",
    offersHelp:
      "هنا ينشر المزودون إعلاناتهم وكوبوناتهم محدودة المدة. لمقارنة أسعار الخدمات وشروطها، افتح مستكشف الخدمات.",
    compare: "استكشف الخدمات وقارن",
  },
  en: {
    ads: "Featured ads",
    adsHelp: "Promotional placements are separate from service price ordering.",
    offersHelp:
      "Providers publish announcements and limited-time coupons here. Open the service explorer to compare service prices and terms.",
    compare: "Explore and compare services",
  },
  es: {
    ads: "Anuncios destacados",
    adsHelp: "Las promociones no cambian el orden de los precios de servicios.",
    offersHelp:
      "Aquí los proveedores publican anuncios y cupones por tiempo limitado. Abre el explorador para comparar precios y condiciones de servicios.",
    compare: "Explorar y comparar servicios",
  },
  hi: {
    ads: "विशेष विज्ञापन",
    adsHelp: "प्रचार सेवाओं की कीमत के क्रम को नहीं बदलता।",
    offersHelp:
      "यहाँ प्रदाता घोषणाएँ और सीमित समय के कूपन प्रकाशित करते हैं। सेवाओं की कीमतों और शर्तों की तुलना के लिए सेवा एक्सप्लोरर खोलें।",
    compare: "सेवाएँ खोजें और तुलना करें",
  },
  zh: {
    ads: "精选广告",
    adsHelp: "推广展示独立于服务价格排序。",
    offersHelp:
      "供应商在此发布公告和限时优惠券。比较服务价格和条款，请打开服务浏览器。",
    compare: "浏览并比较服务",
  },
};
