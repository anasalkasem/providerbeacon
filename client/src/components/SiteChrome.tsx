import { handleHomeNavigation } from "@/lib/homeNavigation";
import { MobileBrowseLinks } from "./MobileBrowseLinks";
import { workspaceCopy } from "@/i18n/workspace";
import { businessText } from "@/i18n/providerBusiness";
import { vipText } from "@/i18n/providerVip";
import { communityCopy } from "@/i18n/community";
import { discoveryText } from "@/i18n/discovery";
import { CatalogueNotice } from "@/components/CatalogueState";
import { useMember } from "@/hooks/useMember";
import { trpc } from "@/lib/trpc";
import { useMemberText } from "@/i18n/memberAuth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copy, localeNames, type Locale, useLocale,
} from "@/contexts/LocaleContext";
import { pageCopy } from "@/i18n/messages";
import { ChevronDown, Globe2, Menu, UserRound, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useSiteTheme } from "@/contexts/SiteAppearanceContext";
import { usePageEntrance } from "@/hooks/usePageEntrance";
import { useDisplayedPagePath } from "./PageTransition";
import { InstallAppLink, MobileAppStatus, MobileNavigation } from "./MobileApp";
import { ThemeModeToggle } from "./ThemeModeToggle";

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  const [path] = useLocation();
  return (
    <Link href="/" onClick={event => handleHomeNavigation(event, path)} className={`brand-link ${inverse ? "brand-inverse" : ""}`} aria-label="ProviderBeacon">
      <img
        src="/images/beacon-lighthouse-logo.webp"
        width={compact ? 40 : 44}
        height={compact ? 40 : 44}
        alt=""
        className={`brand-mark ${compact ? "size-10" : "size-11"}`}
      />
      <span dir="ltr" className={`brand-wordmark ${compact ? "text-[17px]" : "text-xl"} font-extrabold tracking-[-.045em]`}
      >
        Provider<span className="brand-wordmark-accent">Beacon</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const siteTheme = useSiteTheme();
  const { locale, setLocale } = useLocale();
  const t = copy[locale];
  const p = pageCopy[locale];
  const member = useMember();
  const staff = trpc.auth.me.useQuery(undefined, { retry: false });
  const accountHref = staff.data ? "/admin" : member.data?.member ? "/account" : "/sign-in";
  const mt = useMemberText();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const links = [
    ["/find", workspaceCopy[locale].search],
    ["/services", t.navServices],
    ["/providers", t.navProviders],
    ["/compare", t.navCompare],
    ["/groups", communityCopy[locale].nav],
    ["/offers", businessText(locale).offers],
    ["/#methodology", t.navInsights],
  ];

  return (
    <header className="site-header sticky top-0 z-50 border-b border-border/70 backdrop-blur-sm">
      <a href="#main-content" className="skip-link">
        {p.skipMain}
      </a>
      <div className="container flex h-[72px] items-center justify-between gap-5">
        <Brand compact />
        <nav
          aria-label={p.primaryNav}
          className="hidden items-center gap-1 xl:flex"
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${location === href ? "active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <InstallAppLink compact />
        <div className="hidden items-center gap-2 sm:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 text-secondary-foreground">
                <Globe2 className="size-4" />
                {localeNames[locale]}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(localeNames) as Locale[]).map(value => (
                <DropdownMenuItem key={value} onClick={() => setLocale(value)}>
                  {localeNames[value]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            asChild
            variant="outline" className="beacon-ghost"
          >
            <a href={accountHref}>
              <UserRound className="size-4" />
              {staff.data ? t.admin : member.data?.member
                ? workspaceCopy[locale].workspace
                : mt.signIn}
            </a>
          </Button>
        </div>
        <div className={`flex shrink-0 items-center gap-1 ${siteTheme === "daylight" ? "" : "xl:hidden"}`}>
          {siteTheme === "daylight" && <ThemeModeToggle />}
          <button
            className="touch-target rounded-lg p-2 text-secondary-foreground xl:hidden"
            aria-label={open ? "×" : p.mobileNav}
            aria-expanded={open}
            aria-controls="site-mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <div id="site-mobile-menu" className="site-mobile-menu border-t border-border bg-card p-4 xl:hidden">
          <nav className="grid gap-2" aria-label={p.mobileNav}>
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 font-medium text-secondary-foreground hover:bg-muted"
              >
                {label}
              </Link>
            ))}
            <a
              href={accountHref}
              onClick={() => setOpen(false)}
              className="beacon-ghost flex items-center gap-2 rounded-xl px-3 py-3 font-semibold"
            >
              <UserRound className="size-4" />
              {staff.data ? t.admin : member.data?.member
                ? workspaceCopy[locale].workspace
                : mt.signIn}
            </a>
            <div className="sm:hidden">
              <InstallAppLink />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(localeNames) as Locale[]).map(value => (
                <button
                  key={value}
                  onClick={() => setLocale(value)}
                  className={`rounded-lg border px-3 py-2 text-sm ${locale === value ? "border-ring bg-secondary text-foreground" : "border-border"}`}
                >
                  {localeNames[value]}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { locale } = useLocale();
  const t = copy[locale];
  const p = pageCopy[locale];
  const mt = useMemberText();
  return (
    <footer className="site-footer">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Brand compact />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            {p.footerTagline}
          </p>
          <InstallAppLink />
        </div>
        <FooterColumn
          title={p.footerPlatform}
          links={[
            [t.navServices, "/services"],
            [t.navCompare, "/compare"],
            [t.navProviders, "/providers"],
            [vipText(locale).title, "/vip"],
            [communityCopy[locale].nav, "/groups"],
            [businessText(locale).offers, "/offers"],
            [p.trustScores, "/#methodology"],
          ]}
        />
        <FooterColumn
          title={p.footerForProviders}
          links={[
            [p.claimProfile, "/account/provider"],
            [businessText(locale).title, "/account/provider"],
            [p.partnerStandards, "/#methodology"],
            ["JustAnotherPanel API", "/directory/justanotherpanel"],
          ]}
        />
        <FooterColumn
          title={p.footerCompany}
          links={[
            [t.methodology, "/#methodology"],
            [p.about, "/#about"],
            [p.editorialPolicy, "/#methodology"],
            [discoveryText(locale).contactLabel, "/providers#join"],
            [mt.privacy, "/privacy"],
            [t.admin, "/login"],
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="container flex flex-col justify-between gap-3 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>© 2026 ProviderBeacon. {p.rights}</span>
          <span>{p.transparentRanking}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      <ul className="mt-4 grid gap-3 text-sm text-muted-foreground">
        {links.map(([label, href]) => (
          <li key={`${label}-${href}`}>
            <a href={href} className="hover:text-foreground">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicLayout({
  children,
  showCatalogueNotice = true,
}: {
  children: ReactNode;
  showCatalogueNotice?: boolean;
}) {
  const main = useRef<HTMLElement>(null);
  const [path] = useLocation();
  usePageEntrance(main, useDisplayedPagePath(path), useSiteTheme() === "orbit");
  return (
    <div className="public-layout min-h-screen bg-background text-foreground">
      <SiteHeader />
      <MobileAppStatus />
      <MobileBrowseLinks />
      <main id="main-content" ref={main}>
        {showCatalogueNotice && <CatalogueNotice />}
        {children}
      </main>
      <SiteFooter />
      <MobileNavigation />
    </div>
  );
}
