import { Button } from "@/components/ui/button";
import { copy, useLocale } from "@/contexts/LocaleContext";
import { platformColor, providerFor, type Provider, type Service } from "@/data/marketplace";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  ExternalLink,
  Gauge,
  Layers,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export function ScoreRing({
  score,
  size = "md",
  showLabel = false,
}: {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
}) {
  const radius = size === "xl" ? 54 : size === "lg" ? 40 : size === "sm" ? 18 : 26;
  const strokeWidth = size === "xl" ? 8 : size === "lg" ? 6 : size === "sm" ? 3.5 : 4.5;
  const dimension = (radius + strokeWidth) * 2 + 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const scoreColor =
    score >= 95
      ? { stroke: "url(#scoreGradElite)", text: "text-emerald-700", bg: "bg-emerald-50", badge: "Elite" }
      : score >= 90
        ? { stroke: "url(#scoreGradHigh)", text: "text-cyan-700", bg: "bg-cyan-50", badge: "High" }
        : { stroke: "url(#scoreGradGood)", text: "text-blue-700", bg: "bg-blue-50", badge: "Good" };

  return (
    <div className="relative inline-flex flex-col items-center justify-center" aria-label={`Beacon Trust Score ${score} of 100`}>
      <div className="relative inline-grid place-items-center" style={{ width: dimension, height: dimension }}>
        <svg viewBox={`0 0 ${dimension} ${dimension}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke={scoreColor.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
          <defs>
            <linearGradient id="scoreGradElite" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="scoreGradHigh" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            <linearGradient id="scoreGradGood" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex flex-col items-center justify-center leading-none">
          <span
            className={`${
              size === "xl" ? "text-3xl" : size === "lg" ? "text-xl" : size === "sm" ? "text-[11px]" : "text-base"
            } font-black tracking-tight text-slate-900`}
          >
            {score}
          </span>
          {size !== "sm" && <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">Score</span>}
        </div>
      </div>
      {showLabel && (
        <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${scoreColor.bg} ${scoreColor.text}`}>
          {scoreColor.badge}
        </span>
      )}
    </div>
  );
}

export function VerifiedBadge({
  tier = "Tier 1 Direct Source",
  compact = false,
}: {
  tier?: string;
  compact?: boolean;
}) {
  const isDirect = tier.includes("Direct Source");
  const isEnterprise = tier.includes("Enterprise");

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ring-1 ring-inset ${
        isDirect
          ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 ring-emerald-200/80 shadow-xs"
          : isEnterprise
            ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 ring-blue-200/80 shadow-xs"
            : "bg-slate-100 text-slate-800 ring-slate-200"
      } ${compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"}`}
    >
      <ShieldCheck className={compact ? "size-3 text-emerald-600" : "size-3.5 text-emerald-600"} />
      <span>{compact ? "Verified" : tier}</span>
    </span>
  );
}

export function ApiStatusBadge({
  latency,
  uptime = "99.9%",
  compact = false,
}: {
  latency: string;
  uptime?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 font-medium text-slate-700 shadow-2xs backdrop-blur-sm ${
        compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
      }`}
      title={`Live API Latency: ${latency} | Uptime: ${uptime}`}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-semibold text-slate-900">{latency}</span>
      <span className="text-slate-400">·</span>
      <span className="text-slate-500">{uptime}</span>
    </div>
  );
}

export function ProviderAvatar({
  provider,
  large = false,
  xlarge = false,
}: {
  provider: Provider;
  large?: boolean;
  xlarge?: boolean;
}) {
  const gradients = [
    "from-[#0B2A68] via-[#103E99] to-[#0D9488]",
    "from-[#0F172A] via-[#1E293B] to-[#3B82F6]",
    "from-[#0A2540] via-[#0E3A64] to-[#06B6D4]",
    "from-[#111827] via-[#1F2937] to-[#10B981]",
  ];
  const hash = provider.name.charCodeAt(0) % gradients.length;
  const gradient = gradients[hash];

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${gradient} font-extrabold text-white shadow-md shadow-blue-950/10 ${
        xlarge ? "size-20 text-2xl rounded-3xl" : large ? "size-14 text-lg" : "size-11 text-sm"
      }`}
    >
      <span>{provider.initials}</span>
    </div>
  );
}

export function PaymentMethodPill({ method }: { method: string }) {
  const isCrypto = method.toLowerCase().includes("crypto") || method.toLowerCase().includes("usdt");
  const isCard = method.toLowerCase().includes("card") || method.toLowerCase().includes("stripe");
  const isPayPal = method.toLowerCase().includes("paypal");

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
        isCrypto
          ? "bg-amber-50 text-amber-800 border border-amber-200/60"
          : isCard
            ? "bg-blue-50 text-blue-800 border border-blue-200/60"
            : isPayPal
              ? "bg-indigo-50 text-indigo-800 border border-indigo-200/60"
              : "bg-slate-100 text-slate-700 border border-slate-200/60"
      }`}
    >
      {isCard ? <CreditCard className="size-2.5" /> : isCrypto ? <Zap className="size-2.5" /> : null}
      {method}
    </span>
  );
}

export function ProviderCard({
  provider,
  selectedForCompare = false,
  onToggleCompare,
  showCompareToggle = true,
}: {
  provider: Provider;
  selectedForCompare?: boolean;
  onToggleCompare?: (provider: Provider) => void;
  showCompareToggle?: boolean;
}) {
  const { locale } = useLocale();
  const t = copy[locale];

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50">
      {/* Top tier accent banner */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-400 opacity-80" />

      <div>
        {/* Header row: Avatar, Info, Score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <ProviderAvatar provider={provider} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/providers/${provider.slug}`} className="font-black text-sm text-slate-950 hover:text-blue-700 leading-tight">
                  {provider.name}
                </Link>
                {provider.verified && <VerifiedBadge tier={provider.tier} compact />}
              </div>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                <span>{provider.location}</span>
                <span>•</span>
                <span>Since {provider.since}</span>
                <span>•</span>
                <span className="font-semibold text-emerald-700">{provider.totalOrders} orders</span>
              </p>
            </div>
          </div>
          <ScoreRing score={provider.score} size="md" />
        </div>

        {/* Live API Health & Uptime pill */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-slate-100 py-2.5 text-xs">
          <ApiStatusBadge latency={provider.apiLatency} uptime={provider.apiUptime} compact />
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            <span>{provider.rating}</span>
            <span className="font-normal text-slate-400">({provider.reviews})</span>
          </div>
        </div>

        {/* Key SMM Metrics Grid */}
        <div className="mt-3.5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50/80 p-2.5 text-center">
          <div className="px-1.5">
            <div className="flex items-center justify-center gap-1 text-xs font-black text-slate-900">
              <Gauge className="size-3 text-cyan-600" />
              <span>{provider.successRate}%</span>
            </div>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Success</p>
          </div>
          <div className="px-1.5">
            <div className="flex items-center justify-center gap-1 text-xs font-black text-slate-900">
              <RefreshCw className="size-3 text-emerald-600" />
              <span className="truncate">{provider.refillPolicy.includes("Auto") ? provider.refillPolicy.replace("Auto Refill (", "").replace(")", "").replace("Days", "d").trim() : "15d Manual"}</span>
            </div>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Refill</p>
          </div>
          <div className="px-1.5">
            <div className="flex items-center justify-center gap-1 text-xs font-black text-slate-900">
              <DollarSign className="size-3 text-blue-600" />
              <span>{provider.minDeposit}</span>
            </div>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Min Deposit</p>
          </div>
        </div>

        {/* Short description */}
        <p className="mt-3.5 line-clamp-2 text-xs leading-5 text-slate-600">{provider.description}</p>

        {/* Payment Gateways */}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {provider.paymentMethods.slice(0, 3).map((method) => (
            <PaymentMethodPill key={method} method={method} />
          ))}
          {provider.paymentMethods.length > 3 && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              +{provider.paymentMethods.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-5 border-t border-slate-100 pt-3.5 flex items-center gap-2">
        {showCompareToggle && onToggleCompare && (
          <button
            onClick={() => onToggleCompare(provider)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              selectedForCompare
                ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
            title="Compare this provider side-by-side"
          >
            <Scale className="size-3.5" />
            <span>{selectedForCompare ? "Added" : "Compare"}</span>
          </button>
        )}
        <Button
          variant="outline"
          asChild
          className="flex-1 justify-between rounded-xl border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-900 hover:bg-[#0B2A68] hover:text-white"
        >
          <Link href={`/providers/${provider.slug}`}>
            <span>View Full Audit</span>
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function ProviderTableRow({
  provider,
  selectedForCompare = false,
  onToggleCompare,
}: {
  provider: Provider;
  selectedForCompare?: boolean;
  onToggleCompare?: (provider: Provider) => void;
}) {
  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
      <td className="px-4 py-4">
        {onToggleCompare && (
          <button
            onClick={() => onToggleCompare(provider)}
            className={`grid size-5 place-items-center rounded border transition ${
              selectedForCompare ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 bg-white"
            }`}
            aria-label={`${selectedForCompare ? "Remove" : "Add"} ${provider.name} ${
              selectedForCompare ? "from" : "to"
            } comparison`}
          >
            {selectedForCompare && <Check className="size-3.5" />}
          </button>
        )}
      </td>
      <td className="px-4 py-4 min-w-[240px]">
        <Link href={`/providers/${provider.slug}`} className="group flex items-center gap-3">
          <ProviderAvatar provider={provider} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-950 group-hover:text-blue-700">{provider.name}</span>
              {provider.verified && <ShieldCheck className="size-3.5 text-emerald-600" />}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{provider.tier}</p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-4 text-center">
        <ScoreRing score={provider.score} size="sm" />
      </td>
      <td className="px-4 py-4">
        <ApiStatusBadge latency={provider.apiLatency} uptime={provider.apiUptime} compact />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <Gauge className="size-3.5 text-cyan-600" />
          <span>{provider.successRate}%</span>
        </div>
        <p className="text-[10px] text-slate-400">Order success</p>
      </td>
      <td className="px-4 py-4">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
          <RefreshCw className="size-3" />
          {provider.refillPolicy}
        </span>
      </td>
      <td className="px-4 py-4">
        <span className="font-bold text-slate-900">{provider.minDeposit}</span>
        <p className="text-[10px] text-slate-400">Min deposit</p>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {provider.paymentMethods.slice(0, 2).map((method) => (
            <PaymentMethodPill key={method} method={method} />
          ))}
        </div>
      </td>
      <td className="px-4 py-4 text-end">
        <Button asChild size="sm" className="rounded-xl bg-[#0B2A68] hover:bg-blue-900 text-white font-bold text-xs">
          <Link href={`/providers/${provider.slug}`}>View Profile</Link>
        </Button>
      </td>
    </tr>
  );
}

export function ServiceRow({
  service,
  selected,
  onToggle,
}: {
  service: Service;
  selected: boolean;
  onToggle: (service: Service) => void;
}) {
  const provider = providerFor(service);
  return (
    <tr className="service-row">
      <td className="px-4 py-4">
        <button
          onClick={() => onToggle(service)}
          className={`grid size-5 place-items-center rounded border transition ${
            selected ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 bg-white"
          }`}
          aria-label={`${selected ? "Remove" : "Add"} ${service.name} ${selected ? "from" : "to"} comparison`}
        >
          {selected && <Check className="size-3.5" />}
        </button>
      </td>
      <td className="min-w-[280px] px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className="grid size-10 place-items-center rounded-xl text-xs font-extrabold text-white"
            style={{ background: platformColor[service.platform] }}
          >
            {service.platform.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-slate-900">{service.name}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span>{service.category}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">{service.quality}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <Link href={`/providers/${provider.slug}`} className="group flex min-w-[180px] items-center gap-2.5">
          <ProviderAvatar provider={provider} />
          <div>
            <span className="font-bold text-slate-800 group-hover:text-blue-700">{provider.name}</span>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700">
              <ShieldCheck className="size-3" />
              <span>Score {provider.score}</span>
            </div>
          </div>
        </Link>
      </td>
      <td className="px-4 py-4">
        <span className="text-lg font-black text-slate-950">${service.pricePerThousand.toFixed(2)}</span>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">per 1,000</p>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">
        <div className="flex items-center gap-1.5 font-medium">
          <Clock3 className="size-3.5 text-cyan-600" />
          {service.startTime}
        </div>
        <p className="mt-1 text-xs text-slate-400">{service.delivery}</p>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <RefreshCw className="size-3.5 text-blue-600" />
          {service.refill}
        </div>
        <p className="mt-1 text-xs text-slate-400">{service.retention}% retention</p>
      </td>
    </tr>
  );
}
