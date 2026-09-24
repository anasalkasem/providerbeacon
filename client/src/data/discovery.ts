export type Bilingual = { en: string; ar: string };
export const local = (value: Bilingual, locale: string) =>
  locale === "ar" ? value.ar : value.en;
export const discoveryGuides = [
  {
    slug: "instagram-content",
    platform: "Instagram",
    color: "#C13584",
    mark: "IG",
    title: { en: "Content that builds a brand", ar: "محتوى يبني علامتك" },
    summary: {
      en: "Plan your content, commission the creative and define who looks after your community.",
      ar: "خطط للمحتوى، وحدد المواد المطلوبة والمسؤول عن إدارة مجتمعك.",
    },
    scope: { en: "Monthly scope or per asset", ar: "نطاق شهري أو لكل مادة" },
    checks: {
      en: [
        "A content calendar with a clear number of posts and formats.",
        "Original assets, editable files and a written revision allowance.",
        "Reporting tied to reach, meaningful enquiries and agreed business goals.",
      ],
      ar: [
        "تقويم محتوى يحدد عدد المنشورات وأشكالها.",
        "مواد أصلية وملفات قابلة للتعديل وعدد مراجعات واضح.",
        "تقرير يرتبط بالوصول والاستفسارات وأهداف العمل المتفق عليها.",
      ],
    },
    brief: {
      en: "Audience, brand voice, platforms, monthly asset count, approval owner and reporting needs.",
      ar: "الجمهور، نبرة العلامة، المنصات، عدد المواد شهريًا، مسؤول الموافقة والتقارير المطلوبة.",
    },
  },
  {
    slug: "tiktok-creative",
    platform: "TikTok",
    color: "#111827",
    mark: "TK",
    title: {
      en: "Short videos with a clear brief",
      ar: "فيديوهات قصيرة بهدف واضح",
    },
    summary: {
      en: "Compare creators on the work they will deliver: concepts, filming, editing and variations.",
      ar: "قارن صنّاع المحتوى بحسب ما سيسلّمونه: أفكار وتصوير ومونتاج ونسخ بديلة.",
    },
    scope: { en: "Per video or defined batch", ar: "لكل فيديو أو دفعة محددة" },
    checks: {
      en: [
        "Video count, duration, aspect ratio and subtitle languages.",
        "Who supplies the footage, appears on camera and approves the script.",
        "Usage terms, revision rounds and delivery of source files.",
      ],
      ar: [
        "عدد الفيديوهات ومدتها وأبعادها ولغات الترجمة.",
        "من يوفر اللقطات ويظهر أمام الكاميرا ويعتمد النص.",
        "شروط استخدام المواد وجولات التعديل وتسليم الملفات الأصلية.",
      ],
    },
    brief: {
      en: "Product, audience, example tone, filming requirements, languages, deadline and intended placements.",
      ar: "المنتج والجمهور وأمثلة الأسلوب ومتطلبات التصوير واللغات والموعد وأماكن الاستخدام.",
    },
  },
  {
    slug: "youtube-production",
    platform: "YouTube",
    color: "#DC2626",
    mark: "YT",
    title: {
      en: "A stronger video production workflow",
      ar: "إنتاج فيديو أكثر تنظيمًا",
    },
    summary: {
      en: "Find the right scope for scripts, editing, thumbnails and channel content planning.",
      ar: "حدد احتياجك من النصوص والمونتاج والصور المصغّرة وخطة محتوى القناة.",
    },
    scope: {
      en: "Per video or monthly production",
      ar: "لكل فيديو أو إنتاج شهري",
    },
    checks: {
      en: [
        "Separate filming, editing, thumbnails and publishing responsibilities.",
        "Agree on final length, revision limits and turnaround per stage.",
        "Review relevant work samples and request an itemized scope.",
      ],
      ar: [
        "فصل مسؤوليات التصوير والمونتاج والصور المصغرة والنشر.",
        "الاتفاق على المدة النهائية وحدود التعديل وموعد كل مرحلة.",
        "مراجعة نماذج أعمال مناسبة وطلب نطاق عمل مفصّل.",
      ],
    },
    brief: {
      en: "Channel goal, video format, raw footage volume, target length, episode count and upload schedule.",
      ar: "هدف القناة ونوع الفيديو وحجم اللقطات الخام والمدة وعدد الحلقات وجدول النشر.",
    },
  },
  {
    slug: "paid-social-campaigns",
    platform: "Facebook",
    color: "#2563EB",
    mark: "AD",
    title: { en: "Campaigns with visible costs", ar: "حملات بتكاليف واضحة" },
    summary: {
      en: "Compare campaign management with ad spend and creative production shown separately.",
      ar: "قارن إدارة الحملات مع فصل ميزانية الإعلان وتكلفة إنتاج المواد.",
    },
    scope: {
      en: "Management fee plus ad spend",
      ar: "أتعاب الإدارة مع ميزانية الإعلان",
    },
    checks: {
      en: [
        "Management fees, creative costs and media budget listed separately.",
        "Your access to the ad account, campaign data and reporting.",
        "A measurement plan, change approval process and reporting schedule.",
      ],
      ar: [
        "عرض أتعاب الإدارة وتكلفة المواد وميزانية الإعلان كلٌّ على حدة.",
        "وصولك إلى الحساب الإعلاني وبيانات الحملات والتقارير.",
        "خطة قياس وآلية اعتماد التغييرات وجدول التقارير.",
      ],
    },
    brief: {
      en: "Business goal, country, audience, landing page, campaign period and separate media budget.",
      ar: "هدف العمل والدولة والجمهور وصفحة الهبوط وفترة الحملة وميزانية الإعلان المنفصلة.",
    },
  },
  {
    slug: "seo-website-growth",
    platform: "Website",
    color: "#0F766E",
    mark: "SEO",
    title: {
      en: "Website growth you can inspect",
      ar: "تطوير موقع يمكنك متابعة نتائجه",
    },
    summary: {
      en: "Ask for specific audits, fixes and content deliverables when evaluating an SEO proposal.",
      ar: "اطلب فحوصًا وإصلاحات ومواد محددة عند تقييم عرض لتحسين محركات البحث.",
    },
    scope: {
      en: "Audit, project or monthly scope",
      ar: "فحص أو مشروع أو نطاق شهري",
    },
    checks: {
      en: [
        "A prioritized audit with the affected pages and proposed work.",
        "A clear split between recommendations and actual implementation.",
        "Baseline measurements, reporting access and a change log.",
      ],
      ar: [
        "فحص مرتب حسب الأولوية يحدد الصفحات والعمل المقترح.",
        "فصل واضح بين تقديم التوصيات وتنفيذها فعليًا.",
        "قياسات أولية ووصول إلى التقارير وسجل بالتغييرات.",
      ],
    },
    brief: {
      en: "Website, target market, current challenges, implementation access and the pages that matter most.",
      ar: "الموقع والسوق المستهدف والمشكلات الحالية وصلاحية التنفيذ والصفحات الأكثر أهمية.",
    },
  },
  {
    slug: "analytics-reporting",
    platform: "Website",
    color: "#7C3AED",
    mark: "DATA",
    title: {
      en: "Reporting that answers a question",
      ar: "تقارير تجيب عن أسئلتك",
    },
    summary: {
      en: "Define the events, sources and dashboards you need before comparing analytics specialists.",
      ar: "حدد الأحداث ومصادر البيانات والتقارير التي تحتاجها قبل مقارنة المختصين.",
    },
    scope: {
      en: "Setup project or reporting retainer",
      ar: "مشروع إعداد أو تقارير دورية",
    },
    checks: {
      en: [
        "An event and conversion list tied to your business questions.",
        "A validation checklist covering important pages and user journeys.",
        "Dashboard ownership, documentation and a handover session.",
      ],
      ar: [
        "قائمة أحداث وتحويلات مرتبطة بأسئلة العمل.",
        "قائمة تحقق تشمل الصفحات ورحلات المستخدم المهمة.",
        "ملكية لوحة التقارير والتوثيق وجلسة تسليم.",
      ],
    },
    brief: {
      en: "Your main questions, data sources, conversion goals, existing tools and who will use the reports.",
      ar: "أسئلتك الأساسية ومصادر البيانات وأهداف التحويل والأدوات الحالية ومن سيستخدم التقارير.",
    },
  },
] as const;

// Editorial reference profiles, independent of private imported provider records.
// All factual descriptions link to first-party sources; no ratings or prices are inferred.
export const directoryProfiles = [
  {
    slug: "fiverr",
    name: "Fiverr",
    mark: "fi",
    color: "#15803D",
    type: { en: "Freelance marketplace", ar: "سوق للمستقلين" },
    summary: {
      en: "A marketplace with digital marketing categories including social media, SEO and video marketing.",
      ar: "سوق يضم تصنيفات للتسويق الرقمي، منها السوشال ميديا وتحسين البحث وتسويق الفيديو.",
    },
    source: "https://www.fiverr.com/categories/online-marketing",
    tags: ["Instagram", "TikTok", "YouTube", "Website"],
    question: {
      en: "Compare the individual seller's deliverables, revision limits and package scope.",
      ar: "قارن ما يسلّمه البائع نفسه وحدود التعديل ونطاق الباقة.",
    },
  },
  {
    slug: "upwork",
    name: "Upwork",
    mark: "up",
    color: "#166534",
    type: { en: "Freelance marketplace", ar: "سوق للمستقلين" },
    summary: {
      en: "A marketplace where businesses can browse digital marketing professionals and their profiles.",
      ar: "سوق يتيح للشركات استكشاف مختصي التسويق الرقمي وملفاتهم.",
    },
    source: "https://www.upwork.com/hire/digital-marketers/",
    tags: ["Instagram", "YouTube", "Website"],
    question: {
      en: "Define the scope, engagement model and the person responsible for delivery before comparing quotes.",
      ar: "حدد نطاق العمل وطريقة التعاقد والمسؤول عن التسليم قبل مقارنة العروض.",
    },
  },
  {
    slug: "semrush-agency-partners",
    name: "Semrush Agency Partners",
    mark: "S",
    color: "#C2410C",
    type: { en: "Agency directory", ar: "دليل وكالات" },
    summary: {
      en: "Semrush's directory for exploring marketing agencies and the services listed on their profiles.",
      ar: "دليل Semrush لاستكشاف وكالات التسويق والخدمات المدرجة في ملفاتها.",
    },
    source: "https://agencies.semrush.com/",
    tags: ["Website", "Facebook"],
    question: {
      en: "Check the specific agency's relevant projects, included work and reporting arrangements.",
      ar: "افحص مشاريع الوكالة المعنية والعمل المشمول وآلية التقارير.",
    },
  },
  {
    slug: "justanotherpanel",
    name: "JustAnotherPanel",
    mark: "JAP",
    color: "#1D4ED8",
    type: { en: "SMM catalogue provider", ar: "مزود كتالوج SMM" },
    summary: {
      en: "Publishes API documentation for service listings with rates, quantity limits and refill fields.",
      ar: "ينشر توثيق API لقوائم خدمات تتضمن قيم الأسعار وحدود الكميات والتعويض.",
    },
    source: "https://justanotherpanel.com/api",
    tags: ["Instagram", "TikTok", "YouTube", "Website"],
    question: {
      en: "Establish the currency and delivery method for each service. A catalogue listing does not establish authentic engagement.",
      ar: "تحقق من العملة وطريقة تنفيذ كل خدمة. إدراجها في الكتالوج لا يثبت تفاعلًا حقيقيًا.",
    },
  },
] as const;
