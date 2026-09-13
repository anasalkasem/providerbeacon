export type ProviderTier = "Tier 1 Direct Source" | "Verified Enterprise" | "Certified Wholesale" | "Specialized Partner";

export type AuditSignals = {
  apiReliability: number;
  priceFairness: number;
  refillFulfillment: number;
  customerSupport: number;
  complianceAudit: number;
};

export type Provider = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  location: string;
  verified: boolean;
  tier: ProviderTier;
  score: number | null;
  rating: number | null;
  reviews: number;
  responseTime: string;
  apiLatency: string;
  apiUptime: string;
  apiStatus: "online" | "optimal" | "monitoring" | "unknown";
  successRate: number | null;
  updatedMinutes: number | null;
  since: number;
  minDeposit: string;
  refillPolicy: string;
  totalOrders: string;
  activeServicesCount: number;
  priceLevel: "$" | "$$" | "$$$";
  paymentMethods: string[];
  specialties: string[];
  description: string;
  strengths: string[];
  auditSignals: AuditSignals | null;
};

export type Service = {
  id: string;
  providerId: string;
  platform: string;
  category: string;
  name: string;
  pricePerThousand: number;
  min: number;
  max: number;
  startTime: string;
  delivery: string;
  refill: string;
  quality: "Standard" | "Premium" | "Elite";
  retention: number | null;
  featured?: boolean;
};

export const providers: Provider[] = [
  {
    id: "p1",
    slug: "northstar-social",
    name: "Northstar Social",
    initials: "NS",
    location: "Canada",
    verified: true,
    tier: "Tier 1 Direct Source",
    score: 96,
    rating: 4.9,
    reviews: 1420,
    responseTime: "8 min",
    apiLatency: "94ms",
    apiUptime: "99.98%",
    apiStatus: "optimal",
    successRate: 98.9,
    updatedMinutes: 12,
    since: 2019,
    minDeposit: "$10",
    refillPolicy: "Auto Refill (30 Days)",
    totalOrders: "3.4M+",
    activeServicesCount: 2840,
    priceLevel: "$$",
    paymentMethods: ["USDT / Crypto", "Credit Card", "PayPal", "Wise"],
    specialties: ["Instagram", "TikTok", "YouTube", "Telegram"],
    description: "Enterprise-grade direct SMM infrastructure with automated refill dispatch, low latency APIs, and direct server clusters.",
    strengths: ["Direct source servers", "Instant API dispatch", "Automatic 30d refill", "Dedicated SLA support"],
    auditSignals: {
      apiReliability: 98,
      priceFairness: 94,
      refillFulfillment: 98,
      customerSupport: 96,
      complianceAudit: 95,
    },
  },
  {
    id: "p2",
    slug: "pulse-media-lab",
    name: "Pulse Media Lab",
    initials: "PM",
    location: "United Kingdom",
    verified: true,
    tier: "Verified Enterprise",
    score: 94,
    rating: 4.8,
    reviews: 1120,
    responseTime: "14 min",
    apiLatency: "112ms",
    apiUptime: "99.95%",
    apiStatus: "optimal",
    successRate: 97.8,
    updatedMinutes: 18,
    since: 2020,
    minDeposit: "$20",
    refillPolicy: "Auto Refill (45 Days)",
    totalOrders: "2.8M+",
    activeServicesCount: 3620,
    priceLevel: "$$",
    paymentMethods: ["Credit Card", "USDT / Crypto", "Stripe", "Bank Wire"],
    specialties: ["YouTube", "Instagram", "Facebook", "Twitter/X"],
    description: "High-volume wholesale panel tailored for agencies and large resellers requiring steady throughput and granular order tracking.",
    strengths: ["Wholesale capacity", "Sub-150ms sync", "Custom webhook alerts", "Strict quality gating"],
    auditSignals: {
      apiReliability: 96,
      priceFairness: 92,
      refillFulfillment: 95,
      customerSupport: 93,
      complianceAudit: 94,
    },
  },
  {
    id: "p3",
    slug: "sociaflow",
    name: "SociaFlow Global",
    initials: "SF",
    location: "Singapore",
    verified: true,
    tier: "Certified Wholesale",
    score: 92,
    rating: 4.7,
    reviews: 840,
    responseTime: "18 min",
    apiLatency: "138ms",
    apiUptime: "99.91%",
    apiStatus: "optimal",
    successRate: 96.9,
    updatedMinutes: 25,
    since: 2021,
    minDeposit: "$10",
    refillPolicy: "Auto Refill (30 Days)",
    totalOrders: "1.9M+",
    activeServicesCount: 2150,
    priceLevel: "$",
    paymentMethods: ["USDT / Crypto", "Binance Pay", "Credit Card", "Payeer"],
    specialties: ["TikTok", "Instagram", "Telegram", "Spotify"],
    description: "Cost-competitive multi-platform aggregator with strong coverage across Asian, European, and Latin American server networks.",
    strengths: ["Lowest TikTok cost index", "Fast starting servers", "Binance Pay support", "High daily throughput"],
    auditSignals: {
      apiReliability: 93,
      priceFairness: 97,
      refillFulfillment: 91,
      customerSupport: 89,
      complianceAudit: 90,
    },
  },
  {
    id: "p4",
    slug: "apex-smm",
    name: "ApexSMM Direct",
    initials: "AS",
    location: "Germany",
    verified: true,
    tier: "Tier 1 Direct Source",
    score: 95,
    rating: 4.9,
    reviews: 1680,
    responseTime: "10 min",
    apiLatency: "88ms",
    apiUptime: "99.99%",
    apiStatus: "optimal",
    successRate: 98.4,
    updatedMinutes: 8,
    since: 2018,
    minDeposit: "$15",
    refillPolicy: "Auto Refill (60 Days)",
    totalOrders: "4.6M+",
    activeServicesCount: 4200,
    priceLevel: "$",
    paymentMethods: ["Credit Card", "USDT / Crypto", "SEPA Wire", "Wise"],
    specialties: ["Instagram", "YouTube", "Twitter/X", "Telegram"],
    description: "High-speed direct panel powered by European data centers with industry-leading speed, verified non-drop guarantees, and direct API endpoints.",
    strengths: ["60-day auto refill", "Sub-100ms API ping", "Zero reseller markup", "Strict privacy protection"],
    auditSignals: {
      apiReliability: 98,
      priceFairness: 96,
      refillFulfillment: 97,
      customerSupport: 94,
      complianceAudit: 95,
    },
  },
  {
    id: "p5",
    slug: "hyperviral-cloud",
    name: "HyperViral Cloud",
    initials: "HV",
    location: "United States",
    verified: true,
    tier: "Verified Enterprise",
    score: 93,
    rating: 4.8,
    reviews: 970,
    responseTime: "12 min",
    apiLatency: "105ms",
    apiUptime: "99.94%",
    apiStatus: "optimal",
    successRate: 97.6,
    updatedMinutes: 15,
    since: 2020,
    minDeposit: "$25",
    refillPolicy: "Auto Refill (30 Days)",
    totalOrders: "2.1M+",
    activeServicesCount: 1850,
    priceLevel: "$$$",
    paymentMethods: ["Credit Card", "Apple Pay", "PayPal", "USDT / Crypto"],
    specialties: ["TikTok", "Instagram", "YouTube", "Spotify"],
    description: "Premium engagement specialist focusing exclusively on high-retention, algorithm-safe delivery for content creators, artists, and media brands.",
    strengths: ["Organic-speed drip feeding", "High retention algorithms", "US/EU geo-targeting", "White-glove support"],
    auditSignals: {
      apiReliability: 95,
      priceFairness: 90,
      refillFulfillment: 96,
      customerSupport: 95,
      complianceAudit: 94,
    },
  },
  {
    id: "p6",
    slug: "peak-engagement",
    name: "PeakEngagement",
    initials: "PE",
    location: "United Arab Emirates",
    verified: true,
    tier: "Specialized Partner",
    score: 91,
    rating: 4.7,
    reviews: 730,
    responseTime: "16 min",
    apiLatency: "128ms",
    apiUptime: "99.92%",
    apiStatus: "optimal",
    successRate: 96.7,
    updatedMinutes: 22,
    since: 2021,
    minDeposit: "$10",
    refillPolicy: "Auto Refill (30 Days)",
    totalOrders: "1.4M+",
    activeServicesCount: 1640,
    priceLevel: "$$",
    paymentMethods: ["USDT / Crypto", "Credit Card", "Binance Pay", "Wise"],
    specialties: ["Telegram", "Twitter/X", "Instagram", "Discord"],
    description: "Specialized SMM panel optimized for Web3, crypto communities, Telegram member stability, and fast Twitter engagement boosts.",
    strengths: ["Telegram non-drop members", "Crypto community scaling", "Instant webhook dispatch", "Multi-crypto acceptance"],
    auditSignals: {
      apiReliability: 92,
      priceFairness: 93,
      refillFulfillment: 92,
      customerSupport: 91,
      complianceAudit: 90,
    },
  },
  {
    id: "p7",
    slug: "smmboost-pro",
    name: "SMMBoost Pro",
    initials: "SB",
    location: "Netherlands",
    verified: true,
    tier: "Certified Wholesale",
    score: 90,
    rating: 4.6,
    reviews: 890,
    responseTime: "20 min",
    apiLatency: "142ms",
    apiUptime: "99.88%",
    apiStatus: "optimal",
    successRate: 95.8,
    updatedMinutes: 30,
    since: 2019,
    minDeposit: "$10",
    refillPolicy: "Auto Refill (30 Days)",
    totalOrders: "2.3M+",
    activeServicesCount: 2980,
    priceLevel: "$",
    paymentMethods: ["Credit Card", "USDT / Crypto", "iDEAL", "PayPal"],
    specialties: ["YouTube", "TikTok", "Facebook", "Instagram"],
    description: "Wholesale video broadcast and live stream specialist providing high-concurrency viewers, watch time packages, and comment seeding.",
    strengths: ["Live stream high capacity", "YouTube watch hours", "iDEAL and EU payments", "Low minimum thresholds"],
    auditSignals: {
      apiReliability: 91,
      priceFairness: 95,
      refillFulfillment: 90,
      customerSupport: 88,
      complianceAudit: 89,
    },
  },
  {
    id: "p8",
    slug: "orbit-reach",
    name: "Orbit Reach",
    initials: "OR",
    location: "Spain",
    verified: false,
    tier: "Specialized Partner",
    score: 85,
    rating: 4.5,
    reviews: 490,
    responseTime: "28 min",
    apiLatency: "175ms",
    apiUptime: "99.82%",
    apiStatus: "monitoring",
    successRate: 94.5,
    updatedMinutes: 45,
    since: 2022,
    minDeposit: "$5",
    refillPolicy: "Manual Refill (15 Days)",
    totalOrders: "820K+",
    activeServicesCount: 1240,
    priceLevel: "$",
    paymentMethods: ["Credit Card", "PayPal", "Bizum", "USDT"],
    specialties: ["Instagram", "TikTok", "Facebook", "Twitter/X"],
    description: "Entry-friendly panel catering to small teams, individual creators, and boutique marketers with lowest minimum orders and accessible entry tier.",
    strengths: ["Low $5 minimum deposit", "Creator starter packs", "Fast PayPal support", "Boutique support"],
    auditSignals: {
      apiReliability: 86,
      priceFairness: 94,
      refillFulfillment: 84,
      customerSupport: 86,
      complianceAudit: 82,
    },
  },
];

export const services: Service[] = [
  { id: "s1", providerId: "p1", platform: "Instagram", category: "Followers", name: "Instagram Followers — High Retention Non-Drop", pricePerThousand: 2.42, min: 100, max: 100000, startTime: "0–15 min", delivery: "1–3 hours", refill: "30-day auto refill", quality: "Elite", retention: 98, featured: true },
  { id: "s2", providerId: "p4", platform: "Instagram", category: "Followers", name: "Instagram Followers — Direct Source Real Mix", pricePerThousand: 1.85, min: 100, max: 150000, startTime: "0–10 min", delivery: "1–4 hours", refill: "60-day auto refill", quality: "Elite", retention: 97, featured: true },
  { id: "s3", providerId: "p2", platform: "Instagram", category: "Followers", name: "Instagram Followers — Agency High Capacity", pricePerThousand: 1.89, min: 100, max: 50000, startTime: "0–30 min", delivery: "2–6 hours", refill: "45-day auto refill", quality: "Premium", retention: 96, featured: true },
  { id: "s4", providerId: "p3", platform: "Instagram", category: "Followers", name: "Instagram Followers — Economy Value Pack", pricePerThousand: 1.21, min: 50, max: 25000, startTime: "0–60 min", delivery: "4–12 hours", refill: "30-day auto refill", quality: "Standard", retention: 92, featured: true },
  { id: "s5", providerId: "p1", platform: "TikTok", category: "Views", name: "TikTok Views — High Speed Instant Viral", pricePerThousand: 0.45, min: 500, max: 2000000, startTime: "0–5 min", delivery: "10–30 min", refill: "Lifetime guarantee", quality: "Elite", retention: 99, featured: true },
  { id: "s6", providerId: "p5", platform: "TikTok", category: "Views", name: "TikTok Views — FYP Algorithm Optimized", pricePerThousand: 0.72, min: 1000, max: 1000000, startTime: "0–10 min", delivery: "15–45 min", refill: "30-day auto refill", quality: "Elite", retention: 98 },
  { id: "s7", providerId: "p2", platform: "TikTok", category: "Followers", name: "TikTok Followers — High Retention Organic Pace", pricePerThousand: 3.18, min: 100, max: 50000, startTime: "0–30 min", delivery: "2–8 hours", refill: "45-day auto refill", quality: "Elite", retention: 97 },
  { id: "s8", providerId: "p3", platform: "TikTok", category: "Followers", name: "TikTok Followers — Instant Bulk Wholesale", pricePerThousand: 2.65, min: 100, max: 100000, startTime: "0–15 min", delivery: "1–5 hours", refill: "30-day auto refill", quality: "Premium", retention: 95 },
  { id: "s9", providerId: "p4", platform: "YouTube", category: "Views", name: "YouTube Views — High Watch-Time Worldwide", pricePerThousand: 1.65, min: 1000, max: 1000000, startTime: "1–2 hours", delivery: "1–2 days", refill: "60-day auto refill", quality: "Elite", retention: 98, featured: true },
  { id: "s10", providerId: "p7", platform: "YouTube", category: "Views", name: "YouTube Views — Suggested Videos Traffic", pricePerThousand: 1.72, min: 1000, max: 500000, startTime: "1–3 hours", delivery: "1–3 days", refill: "30-day auto refill", quality: "Premium", retention: 97 },
  { id: "s11", providerId: "p2", platform: "YouTube", category: "Subscribers", name: "YouTube Subscribers — Gradual Non-Drop Channel Safe", pricePerThousand: 18.4, min: 50, max: 15000, startTime: "1–4 hours", delivery: "3–7 days", refill: "45-day auto refill", quality: "Elite", retention: 97 },
  { id: "s12", providerId: "p6", platform: "Telegram", category: "Members", name: "Telegram Channel Members — Zero Drop Stable", pricePerThousand: 2.35, min: 100, max: 150000, startTime: "0–15 min", delivery: "1–6 hours", refill: "30-day auto refill", quality: "Elite", retention: 98 },
  { id: "s13", providerId: "p1", platform: "Telegram", category: "Members", name: "Telegram Members — Global Fast Feed", pricePerThousand: 2.76, min: 100, max: 100000, startTime: "0–30 min", delivery: "3–12 hours", refill: "30-day auto refill", quality: "Premium", retention: 95 },
  { id: "s14", providerId: "p4", platform: "Twitter/X", category: "Followers", name: "X (Twitter) Followers — Real Profile Avatars", pricePerThousand: 4.85, min: 50, max: 50000, startTime: "0–30 min", delivery: "3–10 hours", refill: "60-day auto refill", quality: "Elite", retention: 96 },
  { id: "s15", providerId: "p5", platform: "Spotify", category: "Plays", name: "Spotify Track Plays — Tier 1 Premium Royalty Eligible", pricePerThousand: 1.15, min: 1000, max: 2000000, startTime: "0–2 hours", delivery: "1–3 days", refill: "Lifetime guarantee", quality: "Elite", retention: 99 },
  { id: "s16", providerId: "p8", platform: "Facebook", category: "Page likes", name: "Facebook Page Likes & Followers — Global", pricePerThousand: 4.35, min: 100, max: 30000, startTime: "0–2 hours", delivery: "1–2 days", refill: "15-day refill", quality: "Standard", retention: 91 },
];

export const platformColor: Record<string, string> = {
  Instagram: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
  TikTok: "linear-gradient(135deg, #000000, #00f2fe, #fe0979)",
  YouTube: "linear-gradient(135deg, #ff0000, #cc0000)",
  Facebook: "linear-gradient(135deg, #1877f2, #0d5bbd)",
  Telegram: "linear-gradient(135deg, #0088cc, #00b4d8)",
  "Twitter/X": "linear-gradient(135deg, #0f1419, #2b3137)",
  Spotify: "linear-gradient(135deg, #1db954, #14833b)",
};

export const providerFor = (service: Service): Provider => {
  const found = providers.find((provider) => provider.id === service.providerId);
  return found ?? providers[0];
};

export const providerBySlug = (slug: string): Provider | undefined => {
  return providers.find((provider) => provider.slug === slug);
};

export const serviceFor = (id: string): Service | undefined => {
  return services.find((service) => service.id === id);
};
