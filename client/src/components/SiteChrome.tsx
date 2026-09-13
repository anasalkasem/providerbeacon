import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { copy, localeNames, type Locale, useLocale } from "@/contexts/LocaleContext";
import { ChevronDown, Globe2, Menu, ShieldCheck, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";

const logoMarkPath = "/manus-storage/providerbeacon-mark_81edd255.png";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand-link" aria-label="ProviderBeacon home">
      <img src={logoMarkPath} alt="" aria-hidden="true" className={compact ? "size-10" : "size-11"} />
      <span className={`${compact ? "text-[17px]" : "text-xl"} font-extrabold tracking-[-.045em] text-[#0B2A68]`}>Provider<span className="text-[#12AFA7]">Beacon</span></span>
    </Link>
  );
}

export function SiteHeader() {
  const { locale, setLocale } = useLocale();
  const t = copy[locale];
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const links = [
    ["/services", t.navServices],
    ["/providers", t.navProviders],
    ["/compare", t.navCompare],
    ["/#methodology", t.navInsights],
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="container flex h-[72px] items-center justify-between gap-5">
        <Brand compact />
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={`nav-link ${location === href ? "active" : ""}`}>{label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 text-slate-600"><Globe2 className="size-4" />{localeNames[locale]}<ChevronDown className="size-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(localeNames) as Locale[]).map((value) => <DropdownMenuItem key={value} onClick={() => setLocale(value)}>{localeNames[value]}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          {user?.role === "admin" && <Button variant="ghost" asChild><Link href="/admin"><ShieldCheck className="size-4" />{t.admin}</Link></Button>}
          <Button className="rounded-xl bg-[#0B2A68] hover:bg-[#0E347F]" onClick={() => !isAuthenticated && startLogin()}>{isAuthenticated ? user?.name ?? "Account" : t.signIn}</Button>
        </div>
        <button className="touch-target rounded-lg p-2 text-slate-700 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white p-4 lg:hidden">
          <nav className="grid gap-2" aria-label="Mobile navigation">
            {links.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium text-slate-700 hover:bg-slate-50">{label}</Link>)}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(localeNames) as Locale[]).map((value) => <button key={value} onClick={() => setLocale(value)} className={`rounded-lg border px-3 py-2 text-sm ${locale === value ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-slate-200"}`}>{localeNames[value]}</button>)}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div><Brand compact /><p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">Independent provider intelligence for clearer, safer and more transparent service decisions.</p></div>
        <FooterColumn title="Platform" links={[["Discover services", "/services"], ["Compare", "/compare"], ["Provider directory", "/providers"], ["Trust scores", "/#methodology"]]} />
        <FooterColumn title="For providers" links={[["Claim profile", "/providers#join"], ["Get verified", "/providers#join"], ["Partner standards", "/#methodology"], ["Provider API", "/providers#join"]]} />
        <FooterColumn title="Company" links={[["Methodology", "/#methodology"], ["About", "/#methodology"], ["Editorial policy", "/#methodology"], ["Contact", "mailto:hello@providerbeacon.com"]]} />
      </div>
      <div className="border-t border-slate-100"><div className="container flex flex-col justify-between gap-3 py-5 text-xs text-slate-500 sm:flex-row"><span>© 2026 ProviderBeacon. All rights reserved.</span><span>Transparent ranking · No hidden placement</span></div></div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return <div><h2 className="text-sm font-bold text-slate-900">{title}</h2><ul className="mt-4 grid gap-3 text-sm text-slate-500">{links.map(([label, href]) => <li key={label}><a href={href} className="hover:text-[#0B2A68]">{label}</a></li>)}</ul></div>;
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#F6F8FC] text-slate-950"><SiteHeader /><main id="main-content">{children}</main><SiteFooter /></div>;
}
