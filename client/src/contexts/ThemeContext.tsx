import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const THEME_KEY = "theme";
const THEME_USER_SET_KEY = "theme_user_set";

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
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable && typeof window !== "undefined") {
      const userSet = localStorage.getItem(THEME_USER_SET_KEY) === "1";
      const stored = localStorage.getItem(THEME_KEY);
      if (userSet && (stored === "light" || stored === "dark")) {
        return stored;
      }
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable && typeof window !== "undefined") {
      localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => {
          const next = prev === "light" ? "dark" : "light";
          if (typeof window !== "undefined") {
            localStorage.setItem(THEME_USER_SET_KEY, "1");
            localStorage.setItem(THEME_KEY, next);
          }
          return next;
        });
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
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
