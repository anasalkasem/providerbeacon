import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/contexts/LocaleContext";
import { pageCopy } from "@/i18n/messages";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const { locale } = useLocale();
  const t = pageCopy[locale];
  const [, setLocation] = useLocation();
  return <div className="flex min-h-screen w-full items-center justify-center bg-background"><Card className="mx-4 w-full max-w-lg border-border bg-card shadow-none backdrop-blur-sm"><CardContent className="pb-8 pt-8 text-center"><div className="mb-6 flex justify-center"><div className="relative"><div className="absolute inset-0 animate-pulse rounded-full bg-danger-muted"/><AlertCircle className="relative size-16 text-danger"/></div></div><h1 className="mb-2 text-4xl font-bold text-foreground">404</h1><h2 className="mb-4 text-xl font-semibold text-secondary-foreground">{t.notFound}</h2><p className="mb-8 leading-relaxed text-secondary-foreground">{t.notFoundBody}</p><Button onClick={() => setLocation("/")} className="rounded-lg bg-secondary px-6 py-2.5 text-foreground shadow-none transition-all duration-200 hover:bg-secondary shadow-none"><Home className="size-4"/>{t.goHome}</Button></CardContent></Card></div>;
}
