import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const THEMES = new Set(["dark", "blue", "gray"]);
// "system" = San Francisco on Apple devices, Inter elsewhere. Stored under a new
// key because the old key saved "outfit" for every visitor whether they chose it or not.
const FONTS = new Set(["system", "outfit", "space", "mono"]);
const FONT_KEY = "ea_font_v3";
// The Apple style is now the only website style.
const SITE_STYLE = "apple";

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem("ea_theme");
    const migratedToDarkDefault = localStorage.getItem("ea_theme_dark_default_v1");
    if (!migratedToDarkDefault && (!saved || saved === "blue")) {
      localStorage.setItem("ea_theme_dark_default_v1", "1");
      return "dark";
    }
    return THEMES.has(saved) ? saved : "dark";
  });
  const [font, setFontState] = useState(() => {
    const saved = localStorage.getItem(FONT_KEY);
    return FONTS.has(saved) ? saved : "system";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ea_theme", theme);
    // Mobile browsers tint their toolbars with this; keep it matching the page.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "blue" ? "#f5f5f7" : theme === "gray" ? "#1c1c1e" : "#000000";
  }, [theme]);

  // "blue" is the light appearance; dark and gray are dark appearances.
  const scheme = theme === "blue" ? "light" : "dark";

  useEffect(() => {
    document.documentElement.dataset.scheme = scheme;
    document.documentElement.style.colorScheme = scheme;
  }, [scheme]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    localStorage.setItem(FONT_KEY, font);
  }, [font]);

  useEffect(() => {
    document.documentElement.dataset.siteStyle = SITE_STYLE;
  }, []);

  const value = useMemo(() => ({
    theme,
    scheme,
    setTheme: (nextTheme) => {
      if (THEMES.has(nextTheme)) setThemeState(nextTheme);
    },
    font,
    setFont: (nextFont) => {
      if (FONTS.has(nextFont)) setFontState(nextFont);
    },
    siteStyle: SITE_STYLE,
  }), [theme, scheme, font]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
