export type Provider = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  location: string;
  verified: boolean;
  score: number;
  rating: number;
  reviews: number;
  responseTime: string;
  successRate: number;
  updatedMinutes: number;
  since: number;
  description: string;
  strengths: string[];
};

export type Service = {
  id: string;
  providerId: string;
  platform: "Instagram" | "TikTok" | "YouTube" | "Facebook" | "Telegram";
  category: string;
  name: string;
  pricePerThousand: number;
  min: number;
  max: number;
  startTime: string;
  delivery: string;
  refill: string;
  quality: "Standard" | "Premium" | "Elite";
  retention: number;
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
    score: 96,
    rating: 4.9,
    reviews: 1284,
    responseTime: "8 min",
    successRate: 98.7,
    updatedMinutes: 12,
    since: 2019,
    description: "High-retention social growth services with transparent delivery estimates and fast support.",
    strengths: ["Fast start", "30-day refill", "Responsive support"],
  },
  {
    id: "p2",
    slug: "pulse-media-lab",
    name: "Pulse Media Lab",
    initials: "PM",
    location: "United Kingdom",
    verified: true,
    score: 93,
    rating: 4.8,
    reviews: 952,
    responseTime: "14 min",
    successRate: 97.4,
    updatedMinutes: 24,
    since: 2020,
    description: "Performance-focused services for agencies that need stable capacity and detailed order tracking.",
    strengths: ["Agency ready", "Large capacity", "Clear tracking"],
  },
  {
    id: "p3",
    slug: "sociaflow",
    name: "SociaFlow",
    initials: "SF",
    location: "Singapore",
    verified: true,
    score: 91,
    rating: 4.7,
    reviews: 704,
    responseTime: "21 min",
    successRate: 96.9,
    updatedMinutes: 38,
    since: 2021,
    description: "A broad multi-platform catalogue with competitive pricing and consistent delivery windows.",
    strengths: ["Best value", "Multi-platform", "Stable rates"],
  },
  {
    id: "p4",
    slug: "orbit-reach",
    name: "Orbit Reach",
    initials: "OR",
    location: "Spain",
    verified: false,
    score: 84,
    rating: 4.5,
    reviews: 419,
    responseTime: "33 min",
    successRate: 94.1,
    updatedMinutes: 75,
    since: 2022,
    description: "Flexible social promotion packages for creators and small teams with entry-level budgets.",
    strengths: ["Low minimum", "Creator plans", "Flexible quantities"],
  },
];

export const services: Service[] = [
  { id: "s1", providerId: "p1", platform: "Instagram", category: "Followers", name: "Instagram Followers — Premium", pricePerThousand: 2.42, min: 100, max: 100000, startTime: "0–15 min", delivery: "1–3 hours", refill: "30 days", quality: "Elite", retention: 98, featured: true },
  { id: "s2", providerId: "p2", platform: "Instagram", category: "Followers", name: "Instagram Followers — High Retention", pricePerThousand: 1.89, min: 100, max: 50000, startTime: "0–30 min", delivery: "2–6 hours", refill: "30 days", quality: "Premium", retention: 96, featured: true },
  { id: "s3", providerId: "p3", platform: "Instagram", category: "Followers", name: "Instagram Followers — Value", pricePerThousand: 1.21, min: 50, max: 25000, startTime: "0–60 min", delivery: "4–12 hours", refill: "15 days", quality: "Standard", retention: 92, featured: true },
  { id: "s4", providerId: "p1", platform: "TikTok", category: "Views", name: "TikTok Views — Instant", pricePerThousand: 0.54, min: 500, max: 1000000, startTime: "0–5 min", delivery: "15–45 min", refill: "No refill", quality: "Premium", retention: 99 },
  { id: "s5", providerId: "p2", platform: "TikTok", category: "Followers", name: "TikTok Followers — Refill", pricePerThousand: 3.18, min: 100, max: 50000, startTime: "0–30 min", delivery: "2–8 hours", refill: "30 days", quality: "Elite", retention: 97 },
  { id: "s6", providerId: "p3", platform: "YouTube", category: "Views", name: "YouTube Views — Worldwide", pricePerThousand: 1.72, min: 1000, max: 500000, startTime: "1–3 hours", delivery: "1–3 days", refill: "No refill", quality: "Premium", retention: 98 },
  { id: "s7", providerId: "p4", platform: "Facebook", category: "Page likes", name: "Facebook Page Likes — Global", pricePerThousand: 4.35, min: 100, max: 30000, startTime: "0–2 hours", delivery: "1–2 days", refill: "15 days", quality: "Standard", retention: 91 },
  { id: "s8", providerId: "p1", platform: "Telegram", category: "Members", name: "Telegram Members — Stable", pricePerThousand: 2.76, min: 100, max: 100000, startTime: "0–30 min", delivery: "3–12 hours", refill: "30 days", quality: "Premium", retention: 95 },
  { id: "s9", providerId: "p2", platform: "YouTube", category: "Subscribers", name: "YouTube Subscribers — Gradual", pricePerThousand: 18.4, min: 50, max: 10000, startTime: "1–6 hours", delivery: "3–7 days", refill: "30 days", quality: "Elite", retention: 97 },
  { id: "s10", providerId: "p3", platform: "Instagram", category: "Likes", name: "Instagram Likes — Fast", pricePerThousand: 0.68, min: 50, max: 100000, startTime: "0–10 min", delivery: "15–60 min", refill: "No refill", quality: "Premium", retention: 99 },
];

export const providerFor = (service: Service) => providers.find((provider) => provider.id === service.providerId)!;
export const serviceFor = (id: string) => services.find((service) => service.id === id);
export const providerBySlug = (slug: string) => providers.find((provider) => provider.slug === slug);

export const platformColor: Record<Service["platform"], string> = {
  Instagram: "#D9488B",
  TikTok: "#111827",
  YouTube: "#E5484D",
  Facebook: "#2563EB",
  Telegram: "#2AABEE",
};
