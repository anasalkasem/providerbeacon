import { Check, Download, Search, Share, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/SiteChrome";
import { useLocale } from "@/contexts/LocaleContext";
import { useMobileApp } from "@/contexts/MobileAppContext";
import { mobileAppCopy } from "@/i18n/mobileApp";

export default function InstallApp() {
  const { locale } = useLocale();
  const t = mobileAppCopy[locale];
  const app = useMobileApp();
  const steps =
    app.platform === "ios"
      ? [t.iosOne, t.iosTwo, t.iosThree]
      : app.platform === "android"
        ? [t.androidOne, t.androidTwo, t.androidThree]
        : [t.desktopOne, t.desktopTwo];
  return (
    <PublicLayout showCatalogueNotice={false}>
      <div className="app-install-page container">
        <section className="app-install-intro">
          <img
            src="/icon-192.png?v=pb1"
            width="80"
            height="80"
            alt=""
            className="app-icon"
          />
          <p className="app-eyebrow">PROVIDERBEACON</p>
          <h1>{app.installed ? t.installed : t.title}</h1>
          <p className="app-intro">
            {app.installed ? t.installedBody : t.intro}
          </p>
          {app.canInstall && (
            <button
              type="button"
              className="beacon-button"
              onClick={() => void app.install()}
            >
              <Download aria-hidden="true" className="size-5" />
              {t.install}
            </button>
          )}
          {app.installState !== "idle" && !app.installed && (
            <p role="status" className="mt-4 text-sm">
              {app.installState === "opening"
                ? t.installing
                : app.installState === "error"
                  ? t.installError
                  : t.accepted}
            </p>
          )}
          <Link href="/find" className="app-search-link">
            <Search aria-hidden="true" className="size-5" />
            {t.start}
          </Link>
        </section>
        <section className="app-install-details" aria-labelledby="install-how">
          <div className="flex items-center gap-3">
            <Smartphone aria-hidden="true" className="size-6" />
            <h2 id="install-how">{app.installed ? "ProviderBeacon" : t.how}</h2>
          </div>
          {!app.installed && (
            <ol>
              {steps.map((step, index) => (
                <li key={step}>
                  <span className="app-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p>{step}</p>
                  {index === 0 && app.platform === "ios" && (
                    <Share className="size-5 shrink-0" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          )}
          <div className="app-install-note">
            <Check className="size-5 shrink-0" aria-hidden="true" />
            <p>{t.sameAccount}</p>
          </div>
          <p className="app-install-footnote">{t.onlineRequired}</p>
          {!app.installed && (
            <p className="app-install-footnote">{t.fallback}</p>
          )}
        </section>
      </div>
    </PublicLayout>
  );
}
