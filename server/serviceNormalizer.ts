import { createHash } from "node:crypto";
import { platforms, serviceTypes, STALE_DAYS } from "../shared/serviceReview";

export const NORMALIZATION_VERSION = 1;
type Source = Record<string, string | number | boolean | null>;
const sourceKeys = [
  "service",
  "id",
  "name",
  "category",
  "type",
  "rate",
  "price",
  "min",
  "max",
  "refill",
  "cancel",
  "country",
  "countryCode",
  "currency",
  "unit",
];

// Only catalogue fields enter the retained source record. Unknown keys may contain credentials.
export function catalogueSource(raw: Record<string, unknown>): Source {
  return Object.fromEntries(
    sourceKeys.flatMap<[string, string | number | boolean | null]>(key => {
      const value = raw[key];
      return typeof value === "string"
        ? [[key, value.slice(0, 2000)]]
        : typeof value === "boolean" ||
            (typeof value === "number" && Number.isFinite(value))
          ? [[key, value]]
          : [];
    })
  );
}

const aliases: [string, RegExp][] = [
  ["Instagram", /\b(instagram|insta|ig)\b/i],
  ["TikTok", /\b(tik\s?tok)\b/i],
  ["YouTube", /\b(you\s?tube|yt)\b/i],
  ["Facebook", /\b(facebook|fb)\b/i],
  ["Telegram", /\btelegram\b/i],
  ["Twitter", /\b(twitter|x\.com)\b/i],
  ["LinkedIn", /\blinkedin\b/i],
  ["Snapchat", /\bsnapchat\b/i],
  ["Spotify", /\bspotify\b/i],
  ["Twitch", /\btwitch\b/i],
  ["Pinterest", /\bpinterest\b/i],
  ["Reddit", /\breddit\b/i],
];
const countryCodes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " "
  );
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const countries = countryCodes.map(
  code =>
    [
      code,
      new RegExp(`\\b${escapeRegex(countryNames.of(code)!)}\\b`, "i"),
    ] as const
);

export function classifyService(source: Record<string, unknown>) {
  const name = String(source.name ?? "");
  const category = String(source.category ?? "");
  const text = `${name} ${category}`;
  const website = /\b(website|web\s*traffic|site\s*traffic)\b/i.test(text);
  const matches = aliases
    .filter(([, pattern]) => pattern.test(text))
    .map(([platform]) => platform);
  // Referrer lists describe traffic sources, not multiple destination platforms.
  const platform = website
    ? "Website"
    : matches.length === 1
      ? matches[0]!
      : "Unknown";
  const types: [string, RegExp][] = [
    ["Website traffic", /\b(traffic|visitors?)\b/i],
    [
      "Ad management",
      /\b(ad management|ads management|advertising campaign)\b/i,
    ],
    ["Content creation", /\b(content creation|video production)\b/i],
    ["SEO", /\bseo\b/i],
    ["Analytics", /\banalytics\b/i],
    ["Followers", /\bfollowers?\b/i],
    ["Subscribers", /\bsubscribers?\b/i],
    ["Views", /\bviews?\b/i],
    ["Likes", /\blikes?\b/i],
    ["Comments", /\bcomments?\b/i],
    ["Shares", /\bshares?\b/i],
  ];
  const serviceType =
    types.find(([, pattern]) => pattern.test(text))?.[0] ?? "Other";
  const explicitCountry = String(source.countryCode ?? source.country ?? "")
    .toUpperCase()
    .trim();
  const flags = Array.from(
    name.matchAll(new RegExp("[\\u{1F1E6}-\\u{1F1FF}]{2}", "gu"))
  ).map(match =>
    Array.from(match[0])
      .map(char => String.fromCharCode(char.codePointAt(0)! - 0x1f1e6 + 65))
      .join("")
  );
  const foundCountries = new Set([
    ...countries
      .filter(([, pattern]) =>
        pattern.test(`${name} ${category} ${source.country ?? ""}`)
      )
      .map(([code]) => code),
    ...flags.filter(code => countryCodes.includes(code)),
    ...(/\b(usa|united states)\b/i.test(text) ? ["US"] : []),
    ...(/\b(uk|united kingdom)\b/i.test(text) ? ["GB"] : []),
  ]);
  const countryCode = countryCodes.includes(explicitCountry)
    ? explicitCountry
    : foundCountries.size === 1
      ? Array.from(foundCountries)[0]!
      : null;
  const noRefill =
    source.refill === false ||
    /\b(no refill|non[ -]?refill|no guarantee)\b/i.test(text);
  const refillDaysMatch =
    text.match(/\b(\d{1,4})\s*(?:days?|d)\s*(?:refill|guarantee)\b/i) ??
    text.match(/\b(?:refill|guarantee)\s*[:=-]?\s*(\d{1,4})\s*(?:days?|d)\b/i);
  const days = refillDaysMatch ? Number(refillDaysMatch[1]) : null;
  const lifetime = /\blifetime\s*(?:refill|guarantee)\b/i.test(text);
  const yesRefill = source.refill === true || days != null || lifetime;
  const refillMode =
    noRefill && yesRefill
      ? "unknown"
      : noRefill
        ? "none"
        : lifetime
          ? "lifetime"
          : yesRefill
            ? "manual"
            : "unknown";
  const refillDays =
    refillMode === "manual" && days && days <= 3650 ? days : null;
  const notes = [
    ...(platform === "Unknown"
      ? [matches.length > 1 ? "ambiguous_platform" : "unknown_platform"]
      : []),
    ...(serviceType === "Other" ? ["unknown_type"] : []),
    ...(!countryCode
      ? [foundCountries.size > 1 ? "ambiguous_country" : "country_unspecified"]
      : []),
    ...(refillMode === "unknown"
      ? [noRefill && yesRefill ? "refill_conflict" : "refill_unspecified"]
      : []),
    ...([
      "Followers",
      "Views",
      "Likes",
      "Comments",
      "Shares",
      "Subscribers",
      "Website traffic",
    ].includes(serviceType)
      ? ["policy_check"]
      : []),
  ];
  return {
    platform,
    category: serviceType,
    countryCode,
    refillMode,
    refillDays,
    notes,
  };
}

export function normalizeApiService(raw: unknown, index: number) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(
      `Invalid service at row ${index + 1}; no changes were applied`
    );
  const row = raw as Record<string, unknown>;
  const id = row.service ?? row.id;
  const externalId =
    typeof id === "string" || (typeof id === "number" && Number.isFinite(id))
      ? String(id).trim()
      : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const numeric = (value: unknown) =>
    typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "")
      ? Number(value)
      : NaN;
  const price = numeric(row.rate ?? row.price);
  const minOrder = numeric(row.min);
  const maxOrder = numeric(row.max);
  if (
    !externalId ||
    externalId.length > 160 ||
    !name ||
    name.length > 300 ||
    !Number.isFinite(price) ||
    price < 0.0001 ||
    price > 100000 ||
    !Number.isInteger(minOrder) ||
    !Number.isInteger(maxOrder) ||
    minOrder < 1 ||
    maxOrder < minOrder ||
    maxOrder > 2147483647
  ) {
    throw new Error(
      `Invalid ID, name, price or quantities at row ${index + 1}; no changes were applied`
    );
  }
  const sourceData = catalogueSource(row);
  const classification = classifyService(sourceData);
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(sourceData))
    .digest("hex");
  return {
    externalId,
    name,
    pricePerThousandUsd: price.toFixed(4),
    minOrder,
    maxOrder,
    sourceData,
    sourceHash,
    ...classification,
  };
}

export function reviewBlockers(row: {
  platform: string;
  category: string;
  pricingConfirmed: boolean;
  policyReviewed: boolean;
  evidenceUrl: string | null;
  normalizationVersion: number;
  pricePerThousandUsd: string;
  minOrder: number;
  maxOrder: number;
  available: boolean;
}) {
  return [
    ...(row.normalizationVersion < NORMALIZATION_VERSION
      ? ["normalization_pending"]
      : []),
    ...(!platforms.includes(row.platform as (typeof platforms)[number]) ||
    row.platform === "Unknown"
      ? ["unknown_platform"]
      : []),
    ...(!serviceTypes.includes(row.category as (typeof serviceTypes)[number]) ||
    row.category === "Other"
      ? ["unknown_type"]
      : []),
    ...(!row.pricingConfirmed ? ["pricing_unconfirmed"] : []),
    ...(!row.policyReviewed ? ["policy_check"] : []),
    ...(!row.evidenceUrl ? ["evidence_missing"] : []),
    ...(!row.available ? ["source_missing"] : []),
    ...(!(
      Number(row.pricePerThousandUsd) >= 0.0001 &&
      Number(row.pricePerThousandUsd) <= 100000
    ) ||
    row.minOrder < 1 ||
    row.maxOrder < row.minOrder
      ? ["invalid_values"]
      : []),
  ];
}

export function isStale(
  row: { priceCheckedAt: Date | null; sourceUpdatedAt: Date | null },
  now = Date.now()
) {
  const last = [row.priceCheckedAt, row.sourceUpdatedAt]
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return !last || last.getTime() < now - STALE_DAYS * 86400000;
}
