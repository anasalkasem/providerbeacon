import type { Locale } from "@/contexts/LocaleContext";
const strings = {
  title: [
    "Complimentary VIP",
    "VIP مجاني",
    "VIP gratuito",
    "निःशुल्क VIP",
    "免费 VIP",
  ],
  help: [
    "Give a real provider a VIP placement for 7, 30 or 90 days. You manage this card here; billing and subscription benefits are unchanged.",
    "امنح مزودًا حقيقيًا ظهور VIP لمدة 7 أو 30 أو 90 يومًا. تدير هذه البطاقة من هنا، دون دفع أو تغيير مزايا اشتراك المزود.",
    "Ofrece a un proveedor real un espacio VIP de 7, 30 o 90 días. Gestiona la tarjeta aquí; no cambia su facturación ni los beneficios del plan.",
    "वास्तविक प्रदाता को 7, 30 या 90 दिनों के लिए VIP स्थान दें। कार्ड यहीं प्रबंधित करें; बिलिंग और सदस्यता लाभ नहीं बदलेंगे।",
    "为真实服务商提供 7、30 或 90 天的 VIP 展示。在此管理卡片，不改变账单或订阅权益。",
  ],
  duration: [
    "Duration from now",
    "المدة من الآن",
    "Duración desde ahora",
    "अब से अवधि",
    "从现在开始的时长",
  ],
  activate: [
    "Activate complimentary VIP",
    "تفعيل VIP مجانًا",
    "Activar VIP gratuito",
    "निःशुल्क VIP सक्रिय करें",
    "启用免费 VIP",
  ],
  renew: [
    "Save and renew complimentary VIP",
    "حفظ وتجديد VIP المجاني",
    "Guardar y renovar VIP gratuito",
    "निःशुल्क VIP सहेजें और नवीनीकृत करें",
    "保存并续期免费 VIP",
  ],
  stop: [
    "Stop complimentary VIP",
    "إيقاف VIP المجاني",
    "Desactivar VIP gratuito",
    "निःशुल्क VIP रोकें",
    "停止免费 VIP",
  ],
  stopConfirm: [
    "Confirm stopping this complimentary placement?",
    "تأكيد إيقاف هذا الظهور المجاني؟",
    "¿Confirmas desactivar este espacio gratuito?",
    "यह निःशुल्क स्थान रोकना चाहते हैं?",
    "确认停止此免费展示？",
  ],
  confirm: [
    "I reviewed this provider and the card content for publication.",
    "راجعت المزود ومحتوى البطاقة وأوافق على نشرها.",
    "Revisé el proveedor y el contenido de la tarjeta para publicarla.",
    "मैंने प्रकाशन के लिए प्रदाता और कार्ड की सामग्री की समीक्षा की है।",
    "我已审核此服务商和卡片内容，同意发布。",
  ],
  coverHelp: [
    "Optional: upload artwork, or use the provider's existing logo and name.",
    "اختياري: ارفع صورة الإعلان، أو استخدم شعار المزود واسمه الموجودين.",
    "Opcional: sube una imagen o usa el logotipo y nombre actuales del proveedor.",
    "वैकल्पिक: चित्र अपलोड करें या प्रदाता का मौजूदा लोगो और नाम इस्तेमाल करें।",
    "可选：上传图片，或使用服务商现有的标志和名称。",
  ],
  defaultTagline: [
    "Explore this provider's services, prices and terms.",
    "استكشف خدمات هذا المزود وأسعاره وشروطه من صفحة التفاصيل.",
    "Explora los servicios, precios y condiciones de este proveedor.",
    "इस प्रदाता की सेवाएँ, कीमतें और शर्तें देखें।",
    "了解此服务商的服务、价格和条款。",
  ],
  reason: [
    "Internal note",
    "ملاحظة داخلية",
    "Nota interna",
    "आंतरिक टिप्पणी",
    "内部备注",
  ],
  defaultNote: [
    "Complimentary VIP granted by the platform owner.",
    "منح VIP مجاني من مالك المنصة.",
    "VIP gratuito otorgado por el propietario de la plataforma.",
    "प्लेटफ़ॉर्म मालिक द्वारा निःशुल्क VIP प्रदान किया गया।",
    "平台所有者授予的免费 VIP。",
  ],
  ownerOnly: [
    "Only the platform owner can manage complimentary VIP.",
    "فقط مالك المنصة يستطيع إدارة VIP المجاني.",
    "Solo el propietario de la plataforma puede gestionar el VIP gratuito.",
    "केवल प्लेटफ़ॉर्म मालिक निःशुल्क VIP प्रबंधित कर सकता है।",
    "只有平台所有者可以管理免费 VIP。",
  ],
  paidCard: [
    "This provider has a current subscription card. Manage it in VIP card reviews; a free grant cannot replace it.",
    "للمزود بطاقة باشتراك سارٍ. أدرها من مراجعة بطاقات VIP؛ التفعيل المجاني لا يستبدلها.",
    "Este proveedor tiene una tarjeta con suscripción vigente. Gestiónala en la revisión VIP; una concesión gratuita no la reemplaza.",
    "इस प्रदाता का सदस्यता कार्ड सक्रिय है। इसे VIP समीक्षा में प्रबंधित करें; निःशुल्क स्थान इसे नहीं बदल सकता।",
    "此服务商的订阅卡片正在使用中。请在 VIP 卡片审核中管理，免费展示不能替换它。",
  ],
  unavailable: [
    "Choose an active, publicly listed provider with a valid website.",
    "اختر مزودًا نشطًا ظاهرًا للزوار وله موقع صحيح.",
    "Elige un proveedor activo, público y con un sitio web válido.",
    "मान्य वेबसाइट वाला सक्रिय और सार्वजनिक प्रदाता चुनें।",
    "请选择已公开、活跃且具有有效网站的服务商。",
  ],
  activeUntil: [
    "Complimentary VIP ends (UTC)",
    "نهاية VIP المجاني (UTC)",
    "Fin del VIP gratuito (UTC)",
    "निःशुल्क VIP समाप्ति (UTC)",
    "免费 VIP 到期时间（UTC）",
  ],
  managed: [
    "Platform-managed complimentary card",
    "بطاقة مجانية يديرها مالك المنصة",
    "Tarjeta gratuita gestionada por la plataforma",
    "प्लेटफ़ॉर्म द्वारा प्रबंधित निःशुल्क कार्ड",
    "由平台管理的免费卡片",
  ],
} as const;
type Copy = Record<keyof typeof strings, string>;
const index: Record<Locale, number> = { en: 0, ar: 1, es: 2, hi: 3, zh: 4 };
export const vipGrantText = (locale: Locale): Copy =>
  Object.fromEntries(
    Object.entries(strings).map(([key, values]) => [key, values[index[locale]]])
  ) as Copy;
