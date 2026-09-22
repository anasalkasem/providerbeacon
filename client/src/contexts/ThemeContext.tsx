import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
  forcedTheme?: Theme;
  storageKey?: string;
  rememberPreference?: boolean;
}

function readPreference(key: string, fallback: Theme): Theme {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === "light" || stored === "dark" ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  switchable = false,
  forcedTheme,
  storageKey = "theme",
  rememberPreference = true,
}: ThemeProviderProps) {
  // Read before the appearance query resolves. A forced owner theme must not
  // replace the visitor's saved Daylight preference while that query loads.
  const [selectedTheme, setTheme] = useState<Theme>(() =>
    readPreference(storageKey, defaultTheme)
  );
  const [previewTheme, setPreviewTheme] = useState(selectedTheme);
  const theme =
    forcedTheme ?? (rememberPreference ? selectedTheme : previewTheme);
  const canSwitch = switchable && forcedTheme === undefined;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.toggle("dark", theme === "dark");
    return () => {
      root.classList.toggle("dark", wasDark);
    };
  }, [theme]);

  useEffect(() => {
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      const value = event.key === null ? null : event.newValue;
      setTheme(value === "light" || value === "dark" ? value : defaultTheme);
    };
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, [storageKey, defaultTheme]);

  const toggleTheme = canSwitch
    ? () => {
        const next = theme === "light" ? "dark" : "light";
        if (!rememberPreference) {
          setPreviewTheme(next);
          return;
        }
        setTheme(next);
        try {
          window.localStorage.setItem(storageKey, next);
        } catch {
          // Still switch for this visit when browser storage is unavailable.
        }
      }
    : undefined;

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, switchable: canSwitch }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
