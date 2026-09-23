import { catalogueExperience } from "@/i18n/catalogueExperience";
import { ListFilter, Store, Tags, Diamond } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { mobileLayoutCopy } from "@/i18n/mobileLayout";

export function MobileBrowseLinks() {
  const [path] = useLocation();
  const { locale } = useLocale();
  const t = mobileLayoutCopy[locale];
  if (
    !/^\/(?:find|services|providers(?:\/[^/]+)?|compare|offers|vip)?$/.test(
      path
    )
  )
    return null;
  return (
    <nav className="mobile-browse-links container" aria-label={t.browse}>
      {[
        { href: "/services", title: t.services, icon: ListFilter },
        { href: "/providers", title: t.providers, icon: Store },
        { href: "/offers", title: t.offers, icon: Tags },
        { href: "/vip", title: catalogueExperience[locale].ads, icon: Diamond },
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
