import type { Locale } from "@/contexts/LocaleContext";

const strings = {
  launch: [
    "Launch offer",
    "عرض الإطلاق",
    "Oferta de lanzamiento",
    "लॉन्च ऑफ़र",
    "上线优惠",
  ],
  monthly: ["/ month", "/ شهر", "/ mes", "/ माह", "/ 月"],
  intro: [
    "Each of your first {months} months",
    "لكل شهر من أول {months} أشهر",
    "Cada uno de tus primeros {months} meses",
    "आपके पहले {months} महीनों में हर माह",
    "前 {months} 个月，每月",
  ],
  then: [
    "From month {month}",
    "ابتداءً من الشهر {month}",
    "Desde el mes {month}",
    "माह {month} से",
    "从第 {month} 个月起",
  ],
  current: [
    "Monthly subscription price",
    "سعر الاشتراك الشهري",
    "Precio mensual de la suscripción",
    "मासिक सदस्यता मूल्य",
    "每月订阅价格",
  ],
  currency: [
    "All prices are in US dollars (USD).",
    "جميع الأسعار بالدولار الأمريكي (USD).",
    "Todos los precios son en dólares estadounidenses (USD).",
    "सभी कीमतें अमेरिकी डॉलर (USD) में हैं।",
    "所有价格均为美元（USD）。",
  ],
  terms: [
    "The offer runs for {months} consecutive calendar months from your provider’s first activation. It applies once per provider; pausing or renewing does not restart it.",
    "يسري العرض لمدة {months} أشهر ميلادية متتالية من أول تفعيل لباقة مزودك. يُمنح مرة واحدة لكل مزود، ولا يبدأ من جديد عند الإيقاف أو التجديد.",
    "La oferta dura {months} meses naturales consecutivos desde la primera activación del proveedor. Se aplica una vez por proveedor; pausar o renovar no la reinicia.",
    "ऑफ़र प्रदाता के पहले सक्रियण से लगातार {months} कैलेंडर महीनों तक है। यह प्रति प्रदाता एक बार मिलता है; रोकने या नवीनीकरण से दोबारा शुरू नहीं होता।",
    "优惠从供应商首次开通起连续 {months} 个自然月内有效。每个供应商仅享受一次，暂停或续订不会重新开始优惠期。",
  ],
  first: [
    "First activation",
    "أول تفعيل",
    "Primera activación",
    "पहला सक्रियण",
    "首次开通",
  ],
  regularFrom: [
    "Standard price begins",
    "يبدأ السعر العادي في",
    "El precio normal comienza",
    "नियमित मूल्य शुरू होगा",
    "标准价格开始于",
  ],
  awaiting: [
    "Your offer starts when the team activates your provider plan.",
    "يبدأ عرضك عند تفعيل فريقنا لباقة مزودك.",
    "Tu oferta comienza cuando el equipo activa el plan del proveedor.",
    "टीम द्वारा प्रदाता प्लान सक्रिय करने पर आपका ऑफ़र शुरू होता है।",
    "团队开通供应商套餐时，优惠期开始。",
  ],
  manual: [
    "Activation and renewal are handled by our team. Automatic billing is not enabled.",
    "التفعيل والتجديد عبر فريقنا. الخصم التلقائي غير مفعّل.",
    "Nuestro equipo gestiona la activación y renovación. El cobro automático no está habilitado.",
    "सक्रियण और नवीनीकरण हमारी टीम करती है। स्वचालित भुगतान चालू नहीं है।",
    "开通和续订由团队处理，暂未启用自动扣款。",
  ],
  customPeriod: [
    "For active periods, the monthly rate is shown as of the selected start date. These are monthly rates, not a payment total. Check custom durations and any price change before recording the payment reference.",
    "للمدد الفعالة، يظهر السعر الشهري حسب تاريخ البداية المختار. هذه أسعار شهرية وليست إجمالي دفعة. راجع المدد المخصصة وتاريخ تغيّر السعر قبل تسجيل مرجع الدفع.",
    "Para periodos activos, se muestra la tarifa de la fecha de inicio seleccionada. Son tarifas mensuales, no el total de un pago. Revisa las duraciones y los cambios de precio antes de registrar la referencia.",
    "सक्रिय अवधि के लिए चुनी गई आरंभ तारीख की मासिक दर दिखाई जाती है। ये मासिक दरें हैं, भुगतान का कुल नहीं। भुगतान संदर्भ दर्ज करने से पहले कस्टम अवधि और मूल्य बदलाव जाँचें।",
    "有效期限的月费按所选开始日期显示。这是月费，并非付款总额。记录付款参考前，请核对自定义期限及价格变更日期。",
  ],
  preview: [
    "Schedule preview for the selected first activation date",
    "معاينة الأسعار حسب تاريخ أول تفعيل المختار",
    "Vista previa según la fecha de primera activación seleccionada",
    "चुनी हुई पहली सक्रियण तारीख के अनुसार पूर्वावलोकन",
    "按所选首次开通日期预览价格安排",
  ],
  startFixed: [
    "The subscription cannot start before its recorded first activation. Renewals keep the original introductory offer dates.",
    "لا يمكن أن تبدأ مدة الاشتراك قبل أول تفعيل مسجل. يحتفظ التجديد بتواريخ عرض الإطلاق الأصلية.",
    "La suscripción no puede comenzar antes de su primera activación registrada. Las renovaciones mantienen las fechas originales de la oferta.",
    "सदस्यता दर्ज पहले सक्रियण से पहले शुरू नहीं हो सकती। नवीनीकरण में ऑफ़र की मूल तारीखें बनी रहती हैं।",
    "订阅不能早于已记录的首次开通时间。续订保留原有优惠日期。",
  ],
} as const;
const localeIndex: Record<Locale, number> = {
  en: 0,
  ar: 1,
  es: 2,
  hi: 3,
  zh: 4,
};
export function providerPricingText(locale: Locale) {
  return Object.fromEntries(
    Object.entries(strings).map(([key, values]) => [
      key,
      values[localeIndex[locale]],
    ])
  ) as Record<keyof typeof strings, string>;
}
