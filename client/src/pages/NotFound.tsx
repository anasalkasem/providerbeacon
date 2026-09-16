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
  return <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100"><Card className="mx-4 w-full max-w-lg border-0 bg-white/80 shadow-lg backdrop-blur-sm"><CardContent className="pb-8 pt-8 text-center"><div className="mb-6 flex justify-center"><div className="relative"><div className="absolute inset-0 animate-pulse rounded-full bg-red-100"/><AlertCircle className="relative size-16 text-red-500"/></div></div><h1 className="mb-2 text-4xl font-bold text-slate-900">404</h1><h2 className="mb-4 text-xl font-semibold text-slate-700">{t.notFound}</h2><p className="mb-8 leading-relaxed text-slate-600">{t.notFoundBody}</p><Button onClick={() => setLocation("/")} className="rounded-lg bg-brand px-6 py-2.5 text-ink shadow-md transition-all duration-200 hover:bg-beacon-300 hover:shadow-lg"><Home className="size-4"/>{t.goHome}</Button></CardContent></Card></div>;
}
