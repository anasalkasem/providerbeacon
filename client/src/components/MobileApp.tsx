import {
  Bookmark,
  Download,
  House,
  Scale,
  Search,
  UserRound,
  WifiOff,
  RefreshCw,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { useMobileApp } from "@/contexts/MobileAppContext";
import { handleHomeNavigation } from "@/lib/homeNavigation";
import { mobileAppCopy } from "@/i18n/mobileApp";

export function InstallAppLink({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const { installed } = useMobileApp();
  if (installed) return null;
  return (
    <Link
      href="/install"
      className={
        compact
          ? "app-install-link"
          : "inline-flex min-h-11 items-center gap-2 text-sm hover:text-foreground"
      }
      aria-label={mobileAppCopy[locale].install}
    >
      <Download aria-hidden="true" className="size-5" />
      <span className={compact ? "hidden 2xl:inline" : ""}>
        {mobileAppCopy[locale].install}
      </span>
    </Link>
  );
}

export function MobileNavigation() {
  const [path] = useLocation();
  const { locale } = useLocale();
  const t = mobileAppCopy[locale];
  const items = [
    { href: "/", title: t.home, icon: House, active: path === "/" },
    {
      href: "/find",
      title: t.search,
      icon: Search,
      active: /^\/(find|services|providers|directory|offers|vip)(\/|$)/.test(
        path
      ),
    },
    {
      href: "/compare",
      title: t.compare,
      icon: Scale,
      active: path === "/compare",
    },
    {
      href: "/account",
      title: t.saved,
      icon: Bookmark,
      active: path === "/account",
    },
    {
      href: "/account/settings",
      title: t.account,
      icon: UserRound,
      active:
        path.startsWith("/account/") ||
        /^\/(sign-in|sign-up|recover-account)$/.test(path),
    },
  ];
  return (
    <nav className="mobile-app-nav" aria-label={t.navigation}>
      {items.map(({ href, title, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={
            href === "/"
              ? event => handleHomeNavigation(event, path)
              : undefined
          }
        >
          <Icon aria-hidden="true" />
          <span>{title}</span>
        </Link>
      ))}
    </nav>
  );
}

export function MobileAppStatus() {
  const { locale } = useLocale();
  const t = mobileAppCopy[locale];
  const app = useMobileApp();
  if (!app.online)
    return (
      <div className="app-status" role="status">
        <WifiOff aria-hidden="true" className="size-5 shrink-0" />
        <p>{t.offline}</p>
      </div>
    );
  if (!app.updateReady) return null;
  return (
    <div className="app-status" role="status">
      <RefreshCw aria-hidden="true" className="size-5 shrink-0" />
      <div className="flex-1">
        <p>{t.update}</p>
        <p className="text-muted-foreground">{t.updateBody}</p>
      </div>
      <button type="button" className="app-update-button" onClick={app.update}>
        {t.reload}
      </button>
      <button
        type="button"
        className="touch-target"
        onClick={app.dismissUpdate}
        aria-label={t.later}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

/** Keep the chat above the on-screen keyboard without a resize/polling loop. */
export function MobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      // Do not fight the user's pinch zoom.
      if (viewport.scale !== 1) return;
      const root = document.documentElement;
      root.style.setProperty("--app-viewport-height", `${viewport.height}px`);
      root.style.setProperty("--app-viewport-top", `${viewport.offsetTop}px`);
      root.toggleAttribute(
        "data-app-keyboard",
        window.innerHeight - viewport.height > 150
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      document.documentElement.style.removeProperty("--app-viewport-height");
      document.documentElement.style.removeProperty("--app-viewport-top");
      document.documentElement.removeAttribute("data-app-keyboard");
    };
  }, []);
  return null;
}
