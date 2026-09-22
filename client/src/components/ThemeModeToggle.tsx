import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/contexts/LocaleContext";
import { themeModeCopy } from "@/i18n/themeMode";

export function ThemeModeToggle() {
  const { theme, switchable, toggleTheme } = useTheme();
  const { locale } = useLocale();
  if (!switchable) return null;
  const label = themeModeCopy[locale][theme === "dark" ? "light" : "dark"];
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      className="theme-mode-toggle"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      <Icon aria-hidden="true" size={20} />
    </button>
  );
}
