import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const THEMES = new Set(["dark", "blue", "gray", "mono", "vice"]);

/*
 * The Vice City season: for one month the site opens in the sunset palette for everyone.
 * It is a normal appearance the rest of the time — anyone can pick it, or pick
 * something else, and their choice sticks. When the month is over, visitors who
 * never chose Vice City themselves go back to Dark.
 *
 * To move or end the season, change these two dates. The same rules run in the
 * boot script in public/index.html, which paints the page before React loads;
 * keep the two in step.
 */
export const VICE_SEASON_START = Date.parse("2026-11-17T00:00:00Z");
export const VICE_SEASON_END = Date.parse("2026-12-17T00:00:00Z");
const VICE_APPLIED_KEY = "ea_theme_vice_season_v1";
const THEME_PICKED_KEY = "ea_theme_picked_v1";

export const isViceSeason = (now = Date.now()) => now >= VICE_SEASON_START && now < VICE_SEASON_END;

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {}
};
// "system" = San Francisco on Apple devices, Inter elsewhere. Stored under a new
// key because the old key saved "outfit" for every visitor whether they chose it or not.
const FONTS = new Set(["system", "outfit", "space", "mono"]);
const FONT_KEY = "ea_font_v3";
// The Apple style is now the only website style.
const SITE_STYLE = "apple";

// Mobile browsers tint their toolbar with this.
const THEME_COLORS = { dark: "#000000", blue: "#f5f5f7", gray: "#1c1c1e", mono: "#000000", vice: "#140a22" };

export function ThemeProvider({ children }) {
  const [seasonActive] = useState(() => isViceSeason());
  const [theme, setThemeState] = useState(() => {
    const saved = read("ea_theme");
    const pickedTheirOwn = read(THEME_PICKED_KEY) === "1";
    if (isViceSeason()) {
      // Once per visitor, at the start of the season.
      if (!read(VICE_APPLIED_KEY)) {
        write(VICE_APPLIED_KEY, "1");
        return "vice";
      }
    } else if (saved === "vice" && !pickedTheirOwn) {
      return "dark"; // the season is over and they never chose it
    }
    const migratedToDarkDefault = read("ea_theme_dark_default_v1");
    if (!migratedToDarkDefault && (!saved || saved === "blue")) {
      write("ea_theme_dark_default_v1", "1");
      return "dark";
    }
    return THEMES.has(saved) ? saved : "dark";
  });
  const [font, setFontState] = useState(() => {
    const saved = read(FONT_KEY);
    return FONTS.has(saved) ? saved : "system";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    write("ea_theme", theme);
    // Mobile browsers tint their toolbars with this; keep it matching the page.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[theme] || THEME_COLORS.dark;
  }, [theme]);

  // "blue" is the light appearance; dark, gray, mono (Black & White) and vice are dark.
  const scheme = theme === "blue" ? "light" : "dark";

  useEffect(() => {
    document.documentElement.dataset.scheme = scheme;
    document.documentElement.style.colorScheme = scheme;
  }, [scheme]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    write(FONT_KEY, font);
  }, [font]);

  useEffect(() => {
    document.documentElement.dataset.siteStyle = SITE_STYLE;
  }, []);

  const value = useMemo(() => ({
    theme,
    scheme,
    // Picking an appearance here outranks the season, now and after it ends.
    setTheme: (nextTheme) => {
      if (!THEMES.has(nextTheme)) return;
      write(THEME_PICKED_KEY, "1");
      write(VICE_APPLIED_KEY, "1");
      setThemeState(nextTheme);
    },
    seasonActive,
    font,
    setFont: (nextFont) => {
      if (FONTS.has(nextFont)) setFontState(nextFont);
    },
    siteStyle: SITE_STYLE,
  }), [theme, scheme, font, seasonActive]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
