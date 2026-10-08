import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "rb-theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(KEY, theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const setTheme = (t: Theme) => {
    applyTheme(t);
    setThemeState(t);
  };
  return { theme, setTheme };
}
