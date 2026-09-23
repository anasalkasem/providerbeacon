import type { Locale } from "@/contexts/LocaleContext";

const en = {
  title: "Check service attribution", body: "Compare this provider's website, API connections and retained service sources. Domains are clues, not proof of ownership.",
  website: "Provider website", connections: "Saved API connections", sources: "Retained service sources", empty: "No imported API services yet.", noConnections: "No saved API connections.",
  unknown: "Source unavailable", same: "Within website domain", different: "Different domain — review needed", warning: "Some sources differ from the website or have no retained domain. Verify the provider before importing.",
  count: "Services", sample: "Sample internal service ID", loading: "Checking service sources…", failed: "Could not load the source report.", retry: "Refresh report", truncated: "Only the first 100 sources and connections are shown. Review the remaining records before importing.",
  confirm: "I checked that this API belongs to the selected provider, even though its domain differs from the website.",
  conflict: "Import stopped: this provider already has services from a different API host. Review service attribution before reconnecting; existing services were kept.",
  confirmationRequired: "The API domain differs from the provider website. Check the selected provider and confirm the source in the form.",
};
type Copy = { [K in keyof typeof en]: string };
export const providerSourceCopy: Record<Locale, Copy> = {
  en,
  ar: {
    title: "فحص نسبة الخدمات للمزوّد", body: "قارن موقع المزوّد باتصالات API ومصادر الخدمات المحفوظة. تطابق النطاقات مؤشر وليس إثباتًا للملكية.",
    website: "موقع المزوّد", connections: "اتصالات API المحفوظة", sources: "مصادر الخدمات المحفوظة", empty: "لم تُستورد خدمات API بعد.", noConnections: "لا توجد اتصالات API محفوظة.",
    unknown: "المصدر غير متوفر", same: "ضمن نطاق الموقع", different: "نطاق مختلف — يحتاج مراجعة", warning: "بعض المصادر تختلف عن الموقع أو لا تملك نطاقًا محفوظًا. تحقق من المزوّد قبل الاستيراد.",
    count: "الخدمات", sample: "مثال على رقم الخدمة الداخلي", loading: "جارٍ فحص مصادر الخدمات…", failed: "تعذر تحميل تقرير المصادر.", retry: "تحديث التقرير", truncated: "تظهر أول 100 نتيجة من المصادر والاتصالات فقط. راجع بقية السجلات قبل الاستيراد.",
    confirm: "تحققت من أن هذا API يتبع المزوّد المحدد، رغم اختلاف نطاقه عن موقع المزوّد.",
    conflict: "توقف الاستيراد: لدى هذا المزوّد خدمات محفوظة من نطاق API مختلف. راجع نسبة الخدمات قبل إعادة الربط؛ تم الاحتفاظ بالخدمات الحالية.",
    confirmationRequired: "نطاق API يختلف عن موقع المزوّد. تحقق من المزوّد المحدد وأكّد المصدر في النموذج.",
  },
  es: {
    title: "Revisar atribución de servicios", body: "Compara el sitio del proveedor, las conexiones API y las fuentes guardadas. Los dominios son indicios, no pruebas de propiedad.",
    website: "Sitio del proveedor", connections: "Conexiones API guardadas", sources: "Fuentes de servicios guardadas", empty: "Aún no se han importado servicios API.", noConnections: "No hay conexiones API guardadas.",
    unknown: "Fuente no disponible", same: "Dentro del dominio del sitio", different: "Dominio diferente: requiere revisión", warning: "Algunas fuentes difieren del sitio o no tienen un dominio guardado. Verifica el proveedor antes de importar.",
    count: "Servicios", sample: "ID interno de servicio de ejemplo", loading: "Revisando fuentes…", failed: "No se pudo cargar el informe.", retry: "Actualizar informe", truncated: "Solo se muestran las primeras 100 fuentes y conexiones. Revisa el resto antes de importar.",
    confirm: "Verifiqué que esta API pertenece al proveedor seleccionado, aunque su dominio difiere del sitio.",
    conflict: "Importación detenida: el proveedor tiene servicios de otro dominio API. Revisa la atribución antes de reconectar; se conservaron los servicios existentes.",
    confirmationRequired: "El dominio API difiere del sitio del proveedor. Verifica el proveedor y confirma la fuente en el formulario.",
  },
  hi: {
    title: "सेवाओं के प्रदाता की जाँच", body: "प्रदाता की वेबसाइट, API कनेक्शन और सहेजे गए स्रोतों की तुलना करें। डोमेन केवल संकेत हैं, स्वामित्व का प्रमाण नहीं।",
    website: "प्रदाता की वेबसाइट", connections: "सहेजे गए API कनेक्शन", sources: "सहेजे गए सेवा स्रोत", empty: "अभी कोई API सेवा आयात नहीं हुई है।", noConnections: "कोई API कनेक्शन सहेजा नहीं गया है।",
    unknown: "स्रोत उपलब्ध नहीं", same: "वेबसाइट डोमेन के अंतर्गत", different: "अलग डोमेन — समीक्षा आवश्यक", warning: "कुछ स्रोत वेबसाइट से अलग हैं या उनका डोमेन उपलब्ध नहीं है। आयात से पहले प्रदाता की जाँच करें।",
    count: "सेवाएँ", sample: "उदाहरण आंतरिक सेवा ID", loading: "सेवा स्रोतों की जाँच हो रही है…", failed: "स्रोत रिपोर्ट लोड नहीं हुई।", retry: "रिपोर्ट फिर लोड करें", truncated: "केवल पहले 100 स्रोत और कनेक्शन दिखाए गए हैं। आयात से पहले शेष रिकॉर्ड देखें।",
    confirm: "मैंने जाँच लिया है कि अलग डोमेन होने पर भी यह API चुने गए प्रदाता की है।",
    conflict: "आयात रोका गया: इस प्रदाता की सेवाएँ दूसरे API डोमेन से हैं। दोबारा जोड़ने से पहले स्रोत जाँचें; मौजूदा सेवाएँ सुरक्षित हैं।",
    confirmationRequired: "API डोमेन प्रदाता की वेबसाइट से अलग है। प्रदाता की जाँच करके फ़ॉर्म में स्रोत की पुष्टि करें।",
  },
  zh: {
    title: "检查服务归属", body: "对比供应商网站、API 连接和已保存的服务来源。域名只是线索，并不证明所有权。",
    website: "供应商网站", connections: "已保存的 API 连接", sources: "已保存的服务来源", empty: "尚未导入 API 服务。", noConnections: "尚无已保存的 API 连接。",
    unknown: "来源不可用", same: "属于网站域名", different: "域名不同，需要核查", warning: "部分来源与网站不同或没有保留域名。请在导入前核实供应商。",
    count: "服务数", sample: "示例内部服务 ID", loading: "正在检查服务来源…", failed: "无法加载来源报告。", retry: "刷新报告", truncated: "仅显示前 100 个来源和连接。导入前请核查其余记录。",
    confirm: "我已核实此 API 属于所选供应商，尽管其域名与网站不同。",
    conflict: "导入已停止：该供应商已有来自其他 API 域名的服务。重新连接前请核查服务归属；原有服务已保留。",
    confirmationRequired: "API 域名与供应商网站不同。请核实供应商并在表单中确认来源。",
  },
};
export function providerSourceError(message: string, locale: Locale) {
  const copy = providerSourceCopy[locale];
  return message === "catalogue_source_conflict" ? copy.conflict : message === "source_identity_confirmation_required" ? copy.confirmationRequired : message;
}
