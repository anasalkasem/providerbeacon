export const reviewEn = {
  reviewQueue: "Service review",
  reviewSubtitle:
    "Inspect source data, correct details, then approve and publish with a recorded reason.",
  reviewWorklist: "What needs attention?",
  reviewWorklistBody:
    "Counts follow the search and filters above. One service can appear under several reasons. Open its details to complete the required review.",
  allReviewNeeds: "All review reasons",
  need_pricing_unconfirmed: "Pricing unconfirmed",
  need_evidence_missing: "Evidence missing",
  need_policy_check: "Eligibility needs review",
  need_classification: "Classification needs review",
  need_invalid_values: "Invalid price or quantities",
  need_source_missing: "Unavailable at source",
  need_stale: "Stale evidence",
  need_ready: "Ready for approval",
  needHelp_pricing_unconfirmed:
    "Check the currency and price unit against a source, attach its evidence link and explicitly confirm pricing in the service details.",
  needHelp_evidence_missing:
    "Attach a public evidence page supporting this service's price and terms. A provider name or an unsupported claim is insufficient.",
  needHelp_policy_check:
    "Review the service, delivery method and applicable terms before confirming publication eligibility in its details.",
  needHelp_classification:
    "Check the source and correct the platform and service type. Legacy records awaiting normalization remain here until that process finishes.",
  needHelp_invalid_values:
    "Compare the stored price and quantity limits with the source, then correct the values with a recorded reason.",
  needHelp_source_missing:
    "A complete provider synchronization must confirm the service has returned before it becomes eligible for approval.",
  needHelp_stale:
    "Refresh the source or recheck the linked price evidence. Approval requires evidence within the last 30 days.",
  needHelp_ready:
    "These services meet the current data requirements. Inspect their evidence, then approve with a recorded reason. Publishing is a separate action.",
  alertsTitle: "Sync alerts",
  alertsSubtitle:
    "Source records needing review, failed or overdue connections, price changes and unavailable services.",
  catalogueHealth: "Catalogue health",
  catalogueHealthBody:
    "Live database counts. Categories can overlap. Stale means no price evidence within 30 days.",
  all: "All services",
  pending: "Pending review",
  approved: "Approved",
  changes_requested: "Changes requested",
  incomplete: "Incomplete",
  stale: "Stale data",
  price_changed: "Price changed · 7 days",
  missing: "Unavailable at source",
  normalizationPending: "Awaiting classification",
  openReview: "Review details",
  reviewHint:
    "Select up to 50 services from this page. Approval requires complete details, current evidence and an eligibility check. Publishing also requires an active provider.",
  country: "Target country",
  countryHint: "Two-letter code, e.g. US; leave empty if unspecified",
  serviceType: "Service type",
  selected: "Selected",
  selectPage: "Select this page",
  selectService: "Select service",
  clearSelection: "Clear selection",
  approveSelected: "Approve selected",
  requestChanges: "Request changes",
  publishSelected: "Publish selected",
  actionReason: "Reason for this action",
  reasonHint:
    "What did you check or what must be corrected? At least 8 characters.",
  confirmAction: "Confirm action",
  reviewSaved: "Review saved",
  review_conflict:
    "These services changed since you opened them. Refresh and review the latest version.",
  review_not_ready:
    "The selection is not ready. Check missing evidence, provider status, paused services and source freshness.",
  reviewFailed: "The operation could not be completed. Refresh and try again.",
  rawPrice: "Stored rate",
  unconfirmedPrice: "Currency and unit not confirmed",
  confirmedPrice: "Pricing confirmed",
  minQuantity: "Minimum quantity",
  maxQuantity: "Maximum quantity",
  refill: "Refill",
  refillDays: "Refill days (optional)",
  unknown: "Unspecified",
  none: "No refill",
  manual: "Refill available",
  automatic: "Automatic refill",
  lifetime: "Lifetime refill",
  evidenceUrl: "Evidence URL",
  evidenceHelp:
    "Public HTTPS page used to check the price and terms; no query strings or credentials.",
  confirmPricing:
    "I checked the amount, currency and sale unit against the linked evidence.",
  confirmPolicy:
    "I reviewed the service and confirmed it is eligible for publication under the catalogue policy.",
  saveForReview: "Save for review",
  reviewResetHint:
    "Saving these details resets approval. The price-check date changes only when you explicitly confirm the linked price evidence.",
  sourceDetails: "Source record",
  legacySource: "Legacy import — original API response was not retained",
  apiSource: "Provider API",
  originalSource: "Original retained record",
  latestSource: "Latest retained record",
  sourceClaim: "Provider claims are not independent verification.",
  noSource: "No source record is available yet.",
  notes: "Classification notes",
  blockers: "Approval blockers",
  noBlockers: "Required details complete",
  revision: "Revision",
  lastReview: "Last review",
  priceHistory: "Last 20 price records",
  noPriceHistory: "No price history recorded.",
  ambiguous_platform: "Multiple possible platforms",
  unknown_platform: "Platform needs review",
  unknown_type: "Service type needs review",
  ambiguous_country: "Multiple target countries mentioned",
  country_unspecified: "Target country unspecified",
  refill_conflict: "Conflicting refill claims",
  refill_unspecified: "Refill terms unspecified",
  policy_check: "Publication eligibility needs review",
  normalization_pending: "Classification pending",
  pricing_unconfirmed: "Confirm currency and price unit",
  evidence_missing: "Add a price evidence link",
  source_missing: "Service disappeared from the source",
  invalid_values: "Price or quantities are invalid",
  noSyncAlerts:
    "No source issues, failed connections or overdue syncs in the current records.",
  sourceAlertBody:
    "The last completed import contains source records that need review. This alert remains until a later completed import clears them.",
  sourceAlertSnapshot: "Last completed import",
  syncNoIssues: "No source issues on this page.",
  overdueSync: "Sync overdue by more than one hour",
  alertLimit: "Showing up to 50 connections needing attention.",
  recentPriceChanges: "Review changed prices",
  unavailableServices: "Review unavailable services",
  openVault: "Open connections",
  noAlertsPermission: "You do not have permission to view connection alerts.",
  hideService: "Pause service",
  returnDraft: "Return to draft",
  sourceChecked: "Last source / price check",
  classificationRunning:
    "Legacy classification is running in small background batches.",
} as const;

export const reviewAr: Record<keyof typeof reviewEn, string> = {
  reviewQueue: "مراجعة الخدمات",
  reviewSubtitle:
    "افحص المصدر وصحّح التفاصيل، ثم اعتمد وانشر مع تسجيل سبب القرار.",
  reviewWorklist: "ما الذي يحتاج إلى متابعة؟",
  reviewWorklistBody:
    "الأعداد تراعي البحث والفلاتر أعلاه. قد تظهر الخدمة تحت أكثر من سبب. افتح تفاصيلها لاستكمال المراجعة المطلوبة.",
  allReviewNeeds: "كل أسباب المراجعة",
  need_pricing_unconfirmed: "التسعير غير موثق",
  need_evidence_missing: "دليل المصدر مفقود",
  need_policy_check: "الأهلية تحتاج مراجعة",
  need_classification: "التصنيف يحتاج مراجعة",
  need_invalid_values: "السعر أو الكميات غير صالحة",
  need_source_missing: "غير متاحة في المصدر",
  need_stale: "الأدلة قديمة",
  need_ready: "جاهزة للاعتماد",
  needHelp_pricing_unconfirmed:
    "تحقق من العملة ووحدة السعر بالرجوع إلى المصدر، وأرفق رابط الدليل ثم أكّد التسعير صراحةً من تفاصيل الخدمة.",
  needHelp_evidence_missing:
    "أرفق صفحة عامة تدعم سعر هذه الخدمة وشروطها. اسم المزود أو ادعاء بلا دليل لا يكفيان.",
  needHelp_policy_check:
    "راجع طبيعة الخدمة وطريقة تنفيذها والشروط المعمول بها قبل تأكيد أهليتها للنشر من التفاصيل.",
  needHelp_classification:
    "افحص المصدر وصحّح المنصة ونوع الخدمة. تبقى السجلات القديمة التي تنتظر التصنيف هنا حتى اكتمال معالجتها.",
  needHelp_invalid_values:
    "قارن السعر المحفوظ وحدود الكمية بالمصدر، ثم صحّح القيم مع تسجيل سبب التعديل.",
  needHelp_source_missing:
    "يجب أن تؤكد مزامنة مكتملة مع المزود عودة الخدمة إلى المصدر قبل أن تصبح مؤهلة للاعتماد.",
  needHelp_stale:
    "حدّث المصدر أو أعد التحقق من دليل السعر المرتبط. الاعتماد يتطلب دليلاً خلال آخر ٣٠ يومًا.",
  needHelp_ready:
    "هذه الخدمات تستوفي متطلبات البيانات الحالية. افحص أدلتها ثم اعتمدها مع تسجيل السبب. النشر إجراء منفصل.",
  alertsTitle: "تنبيهات المزامنة",
  alertsSubtitle:
    "سجلات المصدر التي تحتاج مراجعة، والاتصالات المتعثرة أو المتأخرة وتغيّر الأسعار والخدمات غير المتاحة.",
  catalogueHealth: "حالة دليل الخدمات",
  catalogueHealthBody:
    "أعداد فعلية من قاعدة البيانات. قد تتداخل الفئات. البيانات القديمة لم يُتحقق من سعرها خلال ٣٠ يومًا.",
  all: "جميع الخدمات",
  pending: "بانتظار المراجعة",
  approved: "معتمدة",
  changes_requested: "مطلوب تعديلها",
  incomplete: "بيانات ناقصة",
  stale: "بيانات قديمة",
  price_changed: "تغيّر السعر · ٧ أيام",
  missing: "غير متاحة لدى المصدر",
  normalizationPending: "بانتظار التصنيف",
  openReview: "مراجعة التفاصيل",
  reviewHint:
    "اختر حتى ٥٠ خدمة من الصفحة الحالية. الاعتماد يتطلب بيانات مكتملة ومصدرًا حديثًا وفحص أهلية الخدمة. النشر يتطلب أيضًا مزودًا نشطًا.",
  country: "الدولة المستهدفة",
  countryHint: "رمز من حرفين مثل US؛ اتركه فارغًا إن لم يُحدد",
  serviceType: "نوع الخدمة",
  selected: "المحدد",
  selectPage: "تحديد هذه الصفحة",
  selectService: "تحديد الخدمة",
  clearSelection: "إلغاء التحديد",
  approveSelected: "اعتماد المحدد",
  requestChanges: "طلب تعديلات",
  publishSelected: "نشر المحدد",
  actionReason: "سبب الإجراء",
  reasonHint: "ما الذي تحققت منه أو ما المطلوب تصحيحه؟ ٨ أحرف على الأقل.",
  confirmAction: "تأكيد الإجراء",
  reviewSaved: "تم حفظ المراجعة",
  review_conflict:
    "تغيّرت هذه الخدمات منذ فتحها. حدّث البيانات وراجع النسخة الأحدث.",
  review_not_ready:
    "الخدمات المحددة غير جاهزة. راجع نواقص الأدلة وحالة المزود والخدمات المتوقفة وحداثة المصدر.",
  reviewFailed: "تعذّر إكمال الإجراء. حدّث البيانات وحاول مجددًا.",
  rawPrice: "السعر المحفوظ",
  unconfirmedPrice: "العملة ووحدة السعر غير مؤكدتين",
  confirmedPrice: "تسعير مؤكد",
  minQuantity: "الكمية الدنيا",
  maxQuantity: "الكمية القصوى",
  refill: "التعويض",
  refillDays: "مدة التعويض بالأيام (اختياري)",
  unknown: "غير محدد",
  none: "دون تعويض",
  manual: "تعويض متاح",
  automatic: "تعويض تلقائي",
  lifetime: "تعويض مدى الحياة",
  evidenceUrl: "رابط الدليل",
  evidenceHelp:
    "صفحة HTTPS عامة استُخدمت لفحص السعر والشروط؛ دون بيانات دخول أو معاملات في الرابط.",
  confirmPricing:
    "تحققت من المبلغ والعملة ووحدة البيع بالرجوع إلى الدليل المرتبط.",
  confirmPolicy: "راجعت الخدمة وتأكدت من أهليتها للنشر وفق سياسة دليل الخدمات.",
  saveForReview: "حفظ للمراجعة",
  reviewResetHint:
    "حفظ التفاصيل يلغي الاعتماد السابق. يتغير تاريخ فحص السعر فقط عند تأكيدك الصريح للدليل المرتبط.",
  sourceDetails: "بيانات المصدر",
  legacySource: "استيراد قديم — لم يُحفظ رد API الأصلي",
  apiSource: "API المزود",
  originalSource: "السجل الأصلي المحفوظ",
  latestSource: "آخر سجل محفوظ",
  sourceClaim: "ادعاءات المزود ليست تحققًا مستقلًا.",
  noSource: "لا يتوفر سجل للمصدر بعد.",
  notes: "ملاحظات التصنيف",
  blockers: "نواقص تمنع الاعتماد",
  noBlockers: "التفاصيل المطلوبة مكتملة",
  revision: "نسخة البيانات",
  lastReview: "آخر مراجعة",
  priceHistory: "آخر ٢٠ سجلًا للسعر",
  noPriceHistory: "لا يوجد سجل أسعار بعد.",
  ambiguous_platform: "أكثر من منصة محتملة",
  unknown_platform: "المنصة تحتاج إلى مراجعة",
  unknown_type: "نوع الخدمة يحتاج إلى مراجعة",
  ambiguous_country: "ذُكرت عدة دول مستهدفة",
  country_unspecified: "الدولة المستهدفة غير محددة",
  refill_conflict: "ادعاءات متعارضة بشأن التعويض",
  refill_unspecified: "شروط التعويض غير محددة",
  policy_check: "أهلية النشر تحتاج إلى مراجعة",
  normalization_pending: "التصنيف قيد الانتظار",
  pricing_unconfirmed: "تأكيد العملة ووحدة السعر مطلوب",
  evidence_missing: "أضف رابط الدليل على السعر",
  source_missing: "الخدمة اختفت من المصدر",
  invalid_values: "السعر أو الكميات غير صالحين",
  noSyncAlerts:
    "لا توجد ملاحظات على المصدر أو اتصالات متعثرة أو مزامنة متأخرة في السجلات الحالية.",
  sourceAlertBody:
    "يحتوي آخر استيراد مكتمل على سجلات مصدر تحتاج إلى مراجعة. يبقى التنبيه حتى يؤكد استيراد مكتمل لاحق زوال هذه الملاحظات.",
  sourceAlertSnapshot: "آخر استيراد مكتمل",
  syncNoIssues: "لا توجد ملاحظات على المصدر في هذه الصفحة.",
  overdueSync: "تأخرت المزامنة أكثر من ساعة",
  alertLimit: "عرض حتى ٥٠ اتصالًا يحتاج إلى متابعة.",
  recentPriceChanges: "مراجعة الأسعار المتغيرة",
  unavailableServices: "مراجعة الخدمات غير المتاحة",
  openVault: "فتح الاتصالات",
  noAlertsPermission: "ليست لديك صلاحية عرض تنبيهات الاتصالات.",
  hideService: "إيقاف الخدمة مؤقتًا",
  returnDraft: "إعادة إلى مسودة",
  sourceChecked: "آخر فحص للمصدر أو السعر",
  classificationRunning:
    "يجري تصحيح التصنيف القديم على دفعات صغيرة في الخلفية.",
};

export function catalogueLabel(locale: string, value: string) {
  if (locale !== "ar") return value;
  return (
    (
      {
        Website: "مواقع الويب",
        Unknown: "غير محدد",
        Followers: "متابعون",
        Views: "مشاهدات",
        Likes: "إعجابات",
        Comments: "تعليقات",
        Shares: "مشاركات",
        Subscribers: "مشتركون",
        "Website traffic": "زيارات المواقع",
        "Ad management": "إدارة الإعلانات",
        "Content creation": "إنشاء المحتوى",
        SEO: "تحسين محركات البحث",
        Analytics: "تحليلات",
        Other: "أخرى",
      } as Record<string, string>
    )[value] ?? value
  );
}
