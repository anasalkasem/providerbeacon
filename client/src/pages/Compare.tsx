import {
  ApiStatusBadge,
  PaymentMethodPill,
  ProviderAvatar,
  ScoreRing,
  VerifiedBadge,
} from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { providerFor, providers, serviceFor, services, type Provider, type Service } from "@/data/marketplace";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Gauge,
  Layers,
  RefreshCw,
  Scale,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Compare() {
  const urlParams = new URLSearchParams(window.location.search);
  const serviceIds = urlParams.get("services")?.split(",").filter(Boolean) ?? ["s1", "s2", "s3"];
  const providerSlugs = urlParams.get("providers")?.split(",").filter(Boolean) ?? [
    "northstar-social",
    "apex-smm",
    "pulse-media-lab",
  ];

  const [activeTab, setActiveTab] = useState<"services" | "providers">(
    urlParams.has("providers") ? "providers" : "services"
  );

  // Selected Services
  const selectedServices = serviceIds.map(serviceFor).filter(Boolean) as Service[];
  const comparedServices = selectedServices.length >= 2 ? selectedServices : services.slice(0, 3);
  const lowestPrice = Math.min(...comparedServices.map((s) => s.pricePerThousand));
  const bestServiceScore = Math.max(...comparedServices.map((s) => providerFor(s).score));

  // Selected Providers
  const selectedProviders = providerSlugs
    .map((slug) => providers.find((p) => p.slug === slug))
    .filter(Boolean) as Provider[];
  const comparedProviders =
    selectedProviders.length >= 2 ? selectedProviders : providers.slice(0, 3);
  const highestProviderScore = Math.max(...comparedProviders.map((p) => p.score));
  const fastestLatency = Math.min(...comparedProviders.map((p) => parseInt(p.apiLatency)));

  return (
    <PublicLayout>
      {/* Compare Header Banner */}
      <section className="border-b border-slate-200/80 bg-white">
        <div className="container py-10 lg:py-12">
          <Button variant="ghost" asChild className="mb-5 -ms-3 text-slate-500 hover:text-slate-900">
            <Link href="/services">
              <ArrowLeft className="size-4 mr-1.5" />
              <span>Back to Services Catalogue</span>
            </Link>
          </Button>

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="eyebrow light">
                <Sparkles className="size-4" />
                Aggregator Benchmark Matrix
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Compare the signals that matter.
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-600 leading-7">
                Transparent side-by-side evaluation of rates, direct API dispatch speed, automatic refill
                commitments, and verified provider reliability.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-2xs">
              <button
                onClick={() => setActiveTab("services")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                  activeTab === "services"
                    ? "bg-white text-slate-950 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="size-4 text-blue-700" />
                <span>Compare Services ({comparedServices.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("providers")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                  activeTab === "providers"
                    ? "bg-white text-slate-950 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Server className="size-4 text-teal-600" />
                <span>Compare SMM Panels ({comparedProviders.length})</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Comparison Matrix Section */}
      <section className="container py-10">
        {activeTab === "services" ? (
          /* SERVICES COMPARISON MATRIX */
          <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xs">
            <table className="min-w-[960px] w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-[240px] bg-slate-50 p-6 text-start align-bottom border-b border-slate-100">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Services Comparison</p>
                    <p className="mt-1 text-lg font-black text-slate-900">Evaluation Signals</p>
                  </th>
                  {comparedServices.map((service) => {
                    const provider = providerFor(service);
                    return (
                      <th
                        key={service.id}
                        className="border-s border-b border-slate-100 p-6 text-start align-top"
                      >
                        <div className="flex items-center gap-3">
                          <ProviderAvatar provider={provider} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-black text-slate-950">{provider.name}</p>
                              {provider.verified && <VerifiedBadge tier={provider.tier} compact />}
                            </div>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                              {service.platform} · {service.category}
                            </p>
                          </div>
                        </div>
                        <h2 className="mt-4 text-sm font-black text-slate-900 line-clamp-2">
                          {service.name}
                        </h2>
                        {provider.score === bestServiceScore && (
                          <span className="mt-2.5 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                            Top Trust Score
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-cyan-600" />
                      <span>Beacon Trust Score</span>
                    </div>
                  </th>
                  {comparedServices.map((s) => {
                    const provider = providerFor(s);
                    return (
                      <td key={s.id} className="border-s border-slate-100 px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <ScoreRing score={provider.score} size="sm" />
                          <div>
                            <p className="font-black text-slate-900 text-sm">{provider.score}/100</p>
                            <p className="text-[10px] text-slate-400">Audited Reliability</p>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <DollarSign className="size-4 text-emerald-600" />
                      <span>Price / 1,000</span>
                    </div>
                  </th>
                  {comparedServices.map((s) => (
                    <td key={s.id} className="border-s border-slate-100 px-6 py-4.5">
                      <div>
                        <p className="text-2xl font-black text-slate-950">${s.pricePerThousand.toFixed(2)}</p>
                        {s.pricePerThousand === lowestPrice && (
                          <span className="mt-1 inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                            Lowest Price in Group
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 text-cyan-600" />
                      <span>Start & Delivery Speed</span>
                    </div>
                  </th>
                  {comparedServices.map((s) => (
                    <td key={s.id} className="border-s border-slate-100 px-6 py-4.5">
                      <p className="font-black text-slate-900 text-sm">{s.startTime}</p>
                      <p className="text-[11px] text-slate-500 font-medium">Delivery: {s.delivery}</p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="size-4 text-blue-600" />
                      <span>Refill Guarantee</span>
                    </div>
                  </th>
                  {comparedServices.map((s) => (
                    <td key={s.id} className="border-s border-slate-100 px-6 py-4.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>{s.refill}</span>
                      </span>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <Gauge className="size-4 text-teal-600" />
                      <span>Retention Rate</span>
                    </div>
                  </th>
                  {comparedServices.map((s) => (
                    <td key={s.id} className="border-s border-slate-100 px-6 py-4.5">
                      <div className="font-black text-slate-900 text-sm">{s.retention}%</div>
                      <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-400"
                          style={{ width: `${s.retention}%` }}
                        />
                      </div>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-amber-500" />
                      <span>Order Quantity Limits</span>
                    </div>
                  </th>
                  {comparedServices.map((s) => (
                    <td key={s.id} className="border-s border-slate-100 px-6 py-4.5 font-bold text-slate-900">
                      {s.min.toLocaleString()} min — {s.max.toLocaleString()} max
                    </td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <th className="bg-slate-50 p-6 text-start text-xs text-slate-500">
                    Direct Provider Link
                  </th>
                  {comparedServices.map((s) => {
                    const provider = providerFor(s);
                    return (
                      <td key={s.id} className="border-s border-slate-100 p-6">
                        <Button
                          asChild
                          className="w-full rounded-xl bg-[#0B2A68] hover:bg-blue-900 text-white font-bold"
                        >
                          <Link href={`/providers/${provider.slug}`}>
                            <span>View Provider Profile</span>
                            <ArrowRight className="size-3.5 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* SMM PANELS COMPARISON MATRIX */
          <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xs">
            <table className="min-w-[960px] w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-[240px] bg-slate-50 p-6 text-start align-bottom border-b border-slate-100">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Panels Comparison</p>
                    <p className="mt-1 text-lg font-black text-slate-900">Infrastructure Signals</p>
                  </th>
                  {comparedProviders.map((provider) => (
                    <th
                      key={provider.id}
                      className="border-s border-b border-slate-100 p-6 text-start align-top"
                    >
                      <div className="flex items-center gap-3">
                        <ProviderAvatar provider={provider} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-black text-slate-950 text-base">{provider.name}</p>
                            {provider.verified && <VerifiedBadge tier={provider.tier} compact />}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{provider.location} · Since {provider.since}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-600 line-clamp-2">{provider.description}</p>
                      {provider.score === highestProviderScore && (
                        <span className="mt-2.5 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          Highest Reliability
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-cyan-600" />
                      <span>Beacon Trust Score</span>
                    </div>
                  </th>
                  {comparedProviders.map((p) => (
                    <td key={p.id} className="border-s border-slate-100 px-6 py-4.5">
                      <div className="flex items-center gap-2.5">
                        <ScoreRing score={p.score} size="sm" />
                        <div>
                          <p className="font-black text-slate-900 text-base">{p.score}/100</p>
                          <p className="text-[10px] text-slate-400">Composite Rating</p>
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <Zap className="size-4 text-amber-500" />
                      <span>Live API Latency</span>
                    </div>
                  </th>
                  {comparedProviders.map((p) => (
                    <td key={p.id} className="border-s border-slate-100 px-6 py-4.5">
                      <ApiStatusBadge latency={p.apiLatency} uptime={p.apiUptime} />
                      {parseInt(p.apiLatency) === fastestLatency && (
                        <p className="mt-1 text-[10px] font-bold text-emerald-700">Fastest API in group</p>
                      )}
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <Gauge className="size-4 text-teal-600" />
                      <span>Order Success Rate</span>
                    </div>
                  </th>
                  {comparedProviders.map((p) => (
                    <td key={p.id} className="border-s border-slate-100 px-6 py-4.5">
                      <div className="flex items-center gap-1.5 font-black text-slate-950 text-sm">
                        <Gauge className="size-4 text-cyan-600" />
                        <span>{p.successRate}%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{p.totalOrders} total orders processed</p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="size-4 text-emerald-600" />
                      <span>Refill SLA & Policy</span>
                    </div>
                  </th>
                  {comparedProviders.map((p) => (
                    <td key={p.id} className="border-s border-slate-100 px-6 py-4.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>{p.refillPolicy}</span>
                      </span>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <DollarSign className="size-4 text-blue-600" />
                      <span>Minimum Deposit</span>
                    </div>
                  </th>
                  {comparedProviders.map((p) => (
                    <td key={p.id} className="border-s border-slate-100 px-6 py-4.5">
                      <p className="font-black text-slate-900 text-base">{p.minDeposit}</p>
                      <p className="text-[10px] text-slate-400">Price Tier: {p.priceLevel}</p>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-indigo-600" />
                      <span>Accepted Payments</span>
                    </div>
                  </th>
                  {comparedProviders.map((p) => (
                    <td key={p.id} className="border-s border-slate-100 px-6 py-4.5">
                      <div className="flex flex-wrap gap-1">
                        {p.paymentMethods.map((m) => (
                          <PaymentMethodPill key={m} method={m} />
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr>
                  <th className="bg-slate-50/70 px-6 py-4.5 text-start font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-slate-600" />
                      <span>Active Services</span>
                    </div>
                  </th>
                  {comparedProviders.map((p) => (
                    <td key={p.id} className="border-s border-slate-100 px-6 py-4.5">
                      <p className="font-black text-slate-900">{p.activeServicesCount.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">Indexed in database</p>
                    </td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <th className="bg-slate-50 p-6 text-start text-xs text-slate-500">
                    Direct Profile Audit
                  </th>
                  {comparedProviders.map((p) => (
                    <td key={p.id} className="border-s border-slate-100 p-6">
                      <Button
                        asChild
                        className="w-full rounded-xl bg-[#0B2A68] hover:bg-blue-900 text-white font-bold"
                      >
                        <Link href={`/providers/${p.slug}`}>
                          <span>View Full Profile</span>
                          <ArrowRight className="size-3.5 ml-1" />
                        </Link>
                      </Button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
