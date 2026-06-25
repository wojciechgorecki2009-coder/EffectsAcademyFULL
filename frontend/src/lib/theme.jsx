import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const THEMES = new Set(["dark", "blue", "gray"]);
const FONTS = new Set(["space", "outfit", "mono"]);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem("ea_theme");
    return THEMES.has(saved) ? saved : "blue";
  });
  const [font, setFontState] = useState(() => {
    const saved = localStorage.getItem("ea_font_v2");
    return FONTS.has(saved) ? saved : "outfit";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ea_theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    localStorage.setItem("ea_font_v2", font);
  }, [font]);

  const value = useMemo(() => ({
    theme,
    setTheme: (nextTheme) => {
      if (THEMES.has(nextTheme)) setThemeState(nextTheme);
    },
    font,
    setFont: (nextFont) => {
      if (FONTS.has(nextFont)) setFontState(nextFont);
    },
  }), [theme, font]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
