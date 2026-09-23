import { adText } from "@/i18n/advertising";
import { ListFilter, Store, Tags } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { mobileLayoutCopy } from "@/i18n/mobileLayout";

export function MobileBrowseLinks() {
  const [path] = useLocation();
  const { locale } = useLocale();
  const t = mobileLayoutCopy[locale];
  if (
    !/^\/(?:find|services|providers(?:\/[^/]+)?|compare|ads|offers|vip)?$/.test(
      path
    )
  )
    return null;
  return (
    <nav className="mobile-browse-links container" aria-label={t.browse}>
      {[
        { href: "/services", title: t.services, icon: ListFilter },
        { href: "/providers", title: t.providers, icon: Store },
        { href: "/ads", title: adText(locale).title, icon: Tags },
      ].map(({ href, title, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            path === href || path.startsWith(href + "/") ? "page" : undefined
          }
        >
          <Icon aria-hidden="true" />
          <span>{title}</span>
        </Link>
      ))}
    </nav>
  );
}
