import { memo, useState } from "react";
import { ArrowRight, PanelsTopLeft, Search, Smartphone } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import HomeComparison from "@/components/HomeComparison";
import { useLocale } from "@/contexts/LocaleContext";
import { studioCopy } from "@/i18n/studio";
import { workspaceCopy } from "@/i18n/workspace";
import { landingCopy } from "@/i18n/landing";

// The supplied SaaS composition, using the host's navigation, fonts, shadcn
// primitives and actual catalogue. No nested <main>, duplicate nav or global CSS.
const Component = memo(function SaaSTemplate() {
  const { locale } = useLocale();
  const t = studioCopy[locale];
  const w = workspaceCopy[locale];
  const l = landingCopy[locale];
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  return (
    <div className="saa-s-template" data-saas-template>
      <section className="studio-hero container" aria-labelledby="studio-title">
        <Link href="/install" className="studio-announcement">
          <Smartphone className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{t.announcement}</span>
          <span className="studio-announcement-more">
            {t.readMore}
            <ArrowRight
              className="size-3.5 rtl:rotate-180"
              aria-hidden="true"
            />
          </span>
        </Link>
        <h1 id="studio-title" className="studio-title">
          <span>{t.title}</span>
          <span>{t.accent}</span>
        </h1>
        <p className="studio-intro">{t.intro}</p>
        <div className="studio-actions">
          <Button asChild size="lg" className="studio-primary">
            <Link href="/find">
              {t.start}
              <ArrowRight
                className="size-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </Button>
          <a href="#how-it-works" className="studio-secondary">
            {t.how}
          </a>
        </div>
      </section>

      <div className="studio-showcase container">
        <div className="studio-horizon" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&h=360&q=60&fm=webp"
            srcSet="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=640&h=192&q=60&fm=webp 640w, https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&h=360&q=60&fm=webp 1200w"
            sizes="(max-width: 640px) 100vw, 1100px"
            width={1200}
            height={360}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="studio-product-frame">
          <div className="studio-product-toolbar">
            <span className="studio-product-brand" dir="ltr">
              <PanelsTopLeft className="size-4" aria-hidden="true" />
              ProviderBeacon
            </span>
            <span>{t.workspace}</span>
            <Link href="/services" className="studio-browse">
              {t.browse}
              <ArrowRight
                className="size-3.5 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>
          <div className="studio-product-content">
            <form
              className="studio-search"
              role="search"
              onSubmit={event => {
                event.preventDefault();
                const request = query.trim();
                navigate(
                  request ? `/find?q=${encodeURIComponent(request)}` : "/find"
                );
              }}
            >
              <label htmlFor="studio-request" className="sr-only">
                {w.ask}
              </label>
              <Search className="size-5 shrink-0" aria-hidden="true" />
              <input
                id="studio-request"
                type="search"
                maxLength={1200}
                value={query}
                onChange={event => setQuery(event.target.value)}
                dir={query ? "auto" : locale === "ar" ? "rtl" : "ltr"}
                placeholder={w.ask}
              />
              <Button type="submit" className="studio-primary">
                {l.search}
                <ArrowRight
                  className="size-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </Button>
            </form>
            <div className="studio-examples">
              {w.examples.map(example => (
                <Link
                  key={example}
                  href={`/find?q=${encodeURIComponent(example)}`}
                >
                  {example}
                  <ArrowRight
                    className="size-3 shrink-0 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
            <HomeComparison />
          </div>
        </div>
      </div>
    </div>
  );
});

export default Component;
