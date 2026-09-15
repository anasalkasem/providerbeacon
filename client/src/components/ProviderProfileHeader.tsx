import {
  trackProviderContact,
  useProviderPageView,
} from "@/lib/providerAnalytics";
import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  Globe2,
  MapPin,
  RefreshCw,
  Send,
} from "lucide-react";
import { Link } from "wouter";
import { copy, useLocale } from "@/contexts/LocaleContext";
import type { Provider } from "@/data/marketplace";
import { catalogueCopy } from "@/i18n/catalogue";
import { formatNumber, localizeData, pageCopy } from "@/i18n/messages";
import { providerProfileCopy } from "@/i18n/providerProfile";
import {
  publicProfileUrl,
  providerTelegramUrl,
} from "../../../shared/providerProfile";
import { ProviderAvatar, VerifiedBadge } from "./Marketplace";
import { ProviderWebsitePreview } from "./ProviderMedia";
import { Button } from "./ui/button";

export default function ProviderProfileHeader({
  provider,
}: {
  provider: Provider;
}) {
  useProviderPageView(provider.id);
  const { locale } = useLocale();
  const t = providerProfileCopy[locale];
  const pages = pageCopy[locale];
  const website = publicProfileUrl(provider.websiteUrl);
  const telegram = providerTelegramUrl(provider.telegramUrl);
  return (
    <section className="border-b border-slate-200 bg-gradient-to-br from-white via-white to-cyan-50/60">
      <div className="container py-8 sm:py-10">
        <Button variant="ghost" asChild className="mb-6 -ms-3 text-slate-500">
          <Link href="/providers">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {copy[locale].navProviders}
          </Link>
        </Button>
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4 sm:gap-5">
              <ProviderAvatar provider={provider} xlarge />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1
                    dir="auto"
                    className="break-words text-2xl font-extrabold tracking-tight text-slate-950 sm:text-4xl"
                  >
                    {provider.name}
                  </h1>
                  {provider.verified && <VerifiedBadge />}
                </div>
                {website && (
                  <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
                    <Globe2 aria-hidden="true" className="size-4 shrink-0" />
                    <bdi dir="ltr" className="truncate">
                      {new URL(website).hostname}
                    </bdi>
                  </p>
                )}
              </div>
            </div>
            {provider.description && (
              <p
                dir="auto"
                className="mt-5 max-w-2xl whitespace-pre-line break-words text-sm leading-7 text-slate-600 sm:text-base"
              >
                {localizeData(locale, provider.description)}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 sm:text-sm">
              {provider.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {localizeData(locale, provider.location)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock3 className="size-4" />
                {locale === "ar" ? "مدرج منذ" : "Listed since"}{" "}
                <bdi>{provider.since}</bdi>
              </span>
              <span className="flex items-center gap-1.5">
                <RefreshCw className="size-4" />
                {provider.updatedMinutes == null
                  ? catalogueCopy[locale].freshnessUnknown
                  : `${pages.updatedAgo} ${formatNumber(locale, provider.updatedMinutes)} ${pages.minutesAgo}`}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {website && (
                <Button asChild className="rounded-xl bg-[#0B2A68]">
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={event =>
                      trackProviderContact(provider.id, "website", event)
                    }
                    onAuxClick={event =>
                      trackProviderContact(provider.id, "website", event)
                    }
                  >
                    {t.visit}
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              )}
              {telegram && (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                >
                  <a
                    href={telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={event =>
                      trackProviderContact(provider.id, "telegram", event)
                    }
                    onAuxClick={event =>
                      trackProviderContact(provider.id, "telegram", event)
                    }
                  >
                    <Send className="size-4" />
                    {t.telegram}
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="rounded-xl">
                <a href="#provider-services">{pages.exploreServices}</a>
              </Button>
            </div>
          </div>
          <ProviderWebsitePreview
            src={provider.websitePreviewUrl}
            title={`${t.preview} · ${provider.name}`}
            openLabel={t.enlarge}
          />
        </div>
      </div>
    </section>
  );
}
