import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";
import type { Locale } from "@/contexts/LocaleContext";

const recoveryCopy = {
  en: {
    title: "We couldn't display this page",
    body: "Reload the page to continue.",
    translation:
      "If browser translation is on, choose “Show original”, then use the site's language menu.",
    email:
      "If you were sending an email, check the email log before sending it again.",
    reload: "Reload page",
    home: "Back to home",
  },
  ar: {
    title: "تعذّر عرض الصفحة",
    body: "أعد تحميل الصفحة للمتابعة.",
    translation:
      "إذا كانت ترجمة المتصفح مفعّلة، اختر «إظهار الأصلي»، ثم اختر العربية من قائمة لغة الموقع.",
    email: "إذا كنت ترسل رسالة، راجع سجل الرسائل قبل إعادة إرسالها.",
    reload: "إعادة تحميل الصفحة",
    home: "العودة للرئيسية",
  },
  es: {
    title: "No se pudo mostrar la página",
    body: "Recarga la página para continuar.",
    translation:
      "Si la traducción del navegador está activa, elige «Mostrar original» y usa el menú de idioma del sitio.",
    email:
      "Si estabas enviando un correo, revisa el registro antes de volver a enviarlo.",
    reload: "Recargar página",
    home: "Volver al inicio",
  },
  hi: {
    title: "पेज नहीं दिखाया जा सका",
    body: "जारी रखने के लिए पेज दोबारा लोड करें।",
    translation:
      "यदि ब्राउज़र अनुवाद चालू है, तो “मूल दिखाएँ” चुनें और साइट के भाषा मेनू का उपयोग करें।",
    email: "यदि आप ईमेल भेज रहे थे, तो दोबारा भेजने से पहले ईमेल लॉग देखें।",
    reload: "पेज दोबारा लोड करें",
    home: "होम पर लौटें",
  },
  zh: {
    title: "无法显示此页面",
    body: "请重新加载页面以继续。",
    translation:
      "如果开启了浏览器翻译，请选择“显示原文”，然后使用网站的语言菜单。",
    email: "如果您正在发送邮件，请先查看邮件记录，再决定是否重新发送。",
    reload: "重新加载页面",
    home: "返回首页",
  },
} satisfies Record<
  Locale,
  {
    title: string;
    body: string;
    translation: string;
    email: string;
    reload: string;
    home: string;
  }
>;

function recoveryLocale(): Locale {
  // This boundary also catches failures above LocaleProvider, so recovery must
  // not depend on context or storage being available.
  if (typeof document === "undefined") return "en";
  const requested = new URLSearchParams(window.location.search).get("lang");
  const language = requested || document.documentElement.lang.split("-")[0];
  return Object.hasOwn(recoveryCopy, language) ? (language as Locale) : "en";
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const locale = recoveryLocale();
      const words = recoveryCopy[locale];
      const changedDom =
        /insertBefore|removeChild|not a child|child can not be found/i.test(
          `${this.state.error?.message} ${this.state.error?.stack}`
        );
      const emailPage =
        typeof window !== "undefined" &&
        /^\/admin\/email\/?$/.test(window.location.pathname);
      return (
        <div
          translate="no"
          lang={locale}
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="notranslate flex min-h-svh items-center justify-center bg-background p-5"
        >
          <div
            role="alert"
            aria-labelledby="page-error-title"
            className="flex w-full min-w-0 max-w-lg flex-col items-center text-center"
          >
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h1 id="page-error-title" className="mb-3 text-xl font-bold">
              {words.title}
            </h1>
            <p className="mb-4 text-sm leading-7 text-muted-foreground">
              {words.body}
            </p>
            {changedDom && (
              <p className="mb-4 text-sm leading-7 text-muted-foreground">
                {words.translation}
              </p>
            )}
            {emailPage && (
              <p className="mb-4 text-sm leading-7 text-muted-foreground">
                {words.email}
              </p>
            )}

            {import.meta.env.DEV && (
              <details className="mb-6 w-full min-w-0 rounded bg-muted p-4 text-start">
                <summary>Developer details</summary>
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} className="shrink-0" />
              <span>{words.reload}</span>
            </button>
            <a
              href="/"
              className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            >
              {words.home}
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
