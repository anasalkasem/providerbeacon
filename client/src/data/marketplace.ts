export type ProviderTier = "Tier 1 Direct Source" | "Verified Enterprise" | "Certified Wholesale" | "Specialized Partner";

export type AuditSignals = {
  apiReliability: number;
  priceFairness: number;
  refillFulfillment: number;
  customerSupport: number;
  complianceAudit: number;
};

export type Provider = {
  apiConnected?: boolean;
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
  catalogueListing?: "api_source" | "reviewed";
  sourceRate?: string | null;
  id: string;
  providerId: string;
  platform: string;
  category: string;
  name: string;
  priceAmount: number;
  priceCurrency: string | null;
  priceUnit: "per_1000" | "per_item" | "package" | null;
  packageDescription?: string | null;
  countryCode?: string | null;
  min: number;
  max: number;
  startTime: string;
  delivery: string;
  refill: string;
  quality: "Standard" | "Premium" | "Elite";
  retention: number | null;
  sourceUrl?: string | null;
  sourceServiceId?: string | null;
  checkedAt?: string | null;
  billingCycle?: "monthly" | null;
  priceType?: "listed" | "from";
  nameAr?: string | null;
  packageDescriptionAr?: string | null;
  terms?: string | null;
  termsAr?: string | null;
  featured?: boolean;
};

export const platformColor: Record<string, string> = {
  Instagram: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
  TikTok: "linear-gradient(135deg, #000000, #00f2fe, #fe0979)",
  YouTube: "linear-gradient(135deg, #ff0000, #cc0000)",
  Facebook: "linear-gradient(135deg, #1877f2, #0d5bbd)",
  Telegram: "linear-gradient(135deg, #0088cc, #00b4d8)",
  "Twitter/X": "linear-gradient(135deg, #0f1419, #2b3137)",
  Spotify: "linear-gradient(135deg, #1db954, #14833b)",
};
