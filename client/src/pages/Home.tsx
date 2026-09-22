import { Link } from "wouter";
import { PublicLayout } from "@/components/SiteChrome";
import { GuideGrid } from "@/components/Discovery";
import HomeDiscovery from "@/components/HomeDiscovery";
import { useLocale } from "@/contexts/LocaleContext";
import { discoveryText } from "@/i18n/discovery";
import { workspaceCopy } from "@/i18n/workspace";
import { landingCopy } from "@/i18n/landing";
import { useSiteTheme } from "@/contexts/SiteAppearanceContext";

export default function Home() {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const l = landingCopy[locale];
  const d = discoveryText(locale);
  const theme = useSiteTheme();
  const steps = [
    { body: t.oneBody, href: "/find" },
    { body: t.twoBody, href: "/compare" },
    { body: t.threeBody, href: "/account" },
  ];
  return (
    <PublicLayout showCatalogueNotice={false}>
      <div className={"beacon-landing home-directory " + theme + "-home"}>
        <HomeDiscovery />
        <section
          id="how-it-works"
          className="landing-details container scroll-mt-24"
        >
          <details>
            <summary>{l.process}</summary>
            <div className="landing-steps">
              {steps.map(({ body, href }, index) => (
                <Link key={href} href={href} className="landing-step">
                  <h3>{l.steps[index]}</h3>
                  <p>{body}</p>
                </Link>
              ))}
            </div>
          </details>
        </section>
        <section
          id="methodology"
          className="landing-details container scroll-mt-24"
        >
          <details>
            <summary>{d.method}</summary>
            <div className="grid gap-8 pt-6 md:grid-cols-2">
              <div>
                <h3>{d.evidence}</h3>
                <p>{d.methodBody}</p>
              </div>
              <div>
                <h3>{d.independence}</h3>
                <p>{d.independenceBody}</p>
              </div>
            </div>
          </details>
          <details>
            <summary>{d.guideTitle}</summary>
            <div className="pt-6">
              <GuideGrid />
            </div>
          </details>
          <details id="about" className="scroll-mt-24">
            <summary>{d.about}</summary>
            <p>{d.aboutBody}</p>
          </details>
        </section>
      </div>
    </PublicLayout>
  );
}
