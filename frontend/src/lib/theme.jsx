import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const THEMES = new Set(["dark", "blue", "gray"]);
const FONTS = new Set(["space", "outfit", "mono"]);
const SITE_STYLES = new Set(["default", "apple", "sleek"]);

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
    const saved = localStorage.getItem("ea_font_v2");
    return FONTS.has(saved) ? saved : "outfit";
  });
  const [siteStyle, setSiteStyleState] = useState(() => {
    const saved = localStorage.getItem("ea_site_style");
    const migratedToAppleDefault = localStorage.getItem("ea_site_style_apple_default_v1");
    if (!migratedToAppleDefault && (!saved || saved === "default")) {
      localStorage.setItem("ea_site_style_apple_default_v1", "1");
      return "apple";
    }
    return SITE_STYLES.has(saved) ? saved : "apple";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ea_theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    localStorage.setItem("ea_font_v2", font);
  }, [font]);

  useEffect(() => {
    document.documentElement.dataset.siteStyle = siteStyle;
    localStorage.setItem("ea_site_style", siteStyle);
  }, [siteStyle]);

  const value = useMemo(() => ({
    theme,
    setTheme: (nextTheme) => {
      if (THEMES.has(nextTheme)) setThemeState(nextTheme);
    },
    font,
    setFont: (nextFont) => {
      if (FONTS.has(nextFont)) setFontState(nextFont);
    },
    siteStyle,
    setSiteStyle: (nextStyle) => {
      if (SITE_STYLES.has(nextStyle)) setSiteStyleState(nextStyle);
    },
  }), [theme, font, siteStyle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
