import type { PriceTargetEmail } from "../shared/priceAlerts";

const words = {
  en: {
    subject: "Your price target is available · ProviderBeacon",
    body: "A service you follow was observed at or below your target for the saved quantity.",
    service: "Service",
    provider: "Provider",
    quantity: "Quantity",
    original: "Cost when saved",
    current: "Observed quantity cost",
    target: "Your target",
    observed: "Price observed at (UTC)",
    action: "Review the offer",
    unsubscribe: "Stop all price-alert emails",
    reason:
      "You requested this price alert. One email is generated per target setting. Check the provider's current price and terms before ordering; payment and delivery fees are excluded.",
  },
  ar: {
    subject: "السعر الذي تتابعه وصل إلى هدفك · ProviderBeacon",
    body: "رصدنا إحدى الخدمات التي تتابعها بسعر يساوي هدفك أو أقل، للكمية التي حفظتها.",
    service: "الخدمة",
    provider: "المزوّد",
    quantity: "الكمية",
    original: "تكلفة الكمية عند الحفظ",
    current: "تكلفة الكمية المرصودة",
    target: "السعر الذي حددته",
    observed: "وقت رصد السعر (UTC)",
    action: "راجع العرض",
    unsubscribe: "إيقاف جميع تنبيهات الأسعار البريدية",
    reason:
      "تصلك هذه الرسالة لأنك طلبت تنبيه السعر. تُنشأ رسالة واحدة لكل إعداد للهدف. راجع السعر والشروط الحالية لدى المزوّد قبل الطلب؛ رسوم الدفع والتوصيل غير مشمولة.",
  },
  es: {
    subject: "Tu precio objetivo está disponible · ProviderBeacon",
    body: "Detectamos un servicio que sigues a un precio igual o inferior a tu objetivo para la cantidad guardada.",
    service: "Servicio",
    provider: "Proveedor",
    quantity: "Cantidad",
    original: "Coste al guardar",
    current: "Coste observado de la cantidad",
    target: "Tu precio objetivo",
    observed: "Fecha del precio observado (UTC)",
    action: "Revisar la oferta",
    unsubscribe: "Desactivar todas las alertas de precios por correo",
    reason:
      "Recibes este mensaje porque solicitaste esta alerta. Se genera un correo por cada configuración del objetivo. Revisa el precio y las condiciones actuales del proveedor antes de comprar; las comisiones de pago y entrega no están incluidas.",
  },
  hi: {
    subject: "आपका लक्षित मूल्य उपलब्ध है · ProviderBeacon",
    body: "आपकी सहेजी गई मात्रा के लिए फ़ॉलो की गई सेवा का मूल्य आपके लक्ष्य के बराबर या उससे कम पाया गया है।",
    service: "सेवा",
    provider: "प्रदाता",
    quantity: "मात्रा",
    original: "सहेजते समय लागत",
    current: "देखी गई मात्रा की लागत",
    target: "आपका लक्ष्य",
    observed: "मूल्य जाँच का समय (UTC)",
    action: "ऑफ़र देखें",
    unsubscribe: "सभी मूल्य अलर्ट ईमेल बंद करें",
    reason:
      "आपको यह ईमेल आपके अनुरोधित मूल्य अलर्ट के कारण मिला है। प्रत्येक लक्ष्य सेटिंग पर एक ईमेल बनता है। ऑर्डर से पहले प्रदाता के वर्तमान मूल्य और शर्तें जाँचें; भुगतान और डिलीवरी शुल्क शामिल नहीं हैं।",
  },
  zh: {
    subject: "已达到您的目标价格 · ProviderBeacon",
    body: "您关注的服务按已保存数量计算的价格已达到或低于您的目标。",
    service: "服务",
    provider: "供应商",
    quantity: "数量",
    original: "保存时的总价",
    current: "观测到的数量总价",
    target: "您的目标价格",
    observed: "价格观测时间 (UTC)",
    action: "查看报价",
    unsubscribe: "关闭所有价格提醒邮件",
    reason:
      "您收到此邮件是因为您主动设置了价格提醒。每次目标设置仅生成一封邮件。下单前请核对供应商当前的价格与条款；不含支付及交付费用。",
  },
};

export function priceTargetEmailContent(
  data: PriceTargetEmail,
  locale: keyof typeof words
) {
  const w = words[locale];
  const amount = (value: string) => `${data.currency} ${value}`;
  const rows = [
    [w.service, data.service],
    [w.provider, data.provider],
    [w.quantity, data.quantity.toLocaleString(locale)],
    [w.original, amount(data.original)],
    [w.current, amount(data.current)],
    [w.target, amount(data.target)],
    [
      w.observed,
      new Date(data.observedAt).toLocaleString(locale, { timeZone: "UTC" }),
    ],
  ];
  return { ...w, rows };
}

// Preview data only; this object is never used by the alert evaluator or sender.
export const previewPriceTarget: PriceTargetEmail = {
  service: "Example service · خدمة توضيحية",
  provider: "Example provider",
  quantity: 5000,
  currency: "USD",
  original: "13.00",
  current: "12.00",
  target: "12.00",
  observedAt: "2026-09-15T00:00:00Z",
};
