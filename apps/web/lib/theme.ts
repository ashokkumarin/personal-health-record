import { createTheme, type Theme } from "@mui/material/styles";

export const DEFAULT_BANNER_COLOR = "#00695c";
export const THEME_STORAGE_KEY = "phr:bannerColor";
export const THEME_CHANGED_EVENT = "phr:theme-changed";

export const BANNER_COLOR_PRESETS: { label: string; color: string }[] = [
  { label: "Teal", color: "#00695c" },
  { label: "Indigo", color: "#283593" },
  { label: "Deep Purple", color: "#4527a0" },
  { label: "Blue", color: "#1565c0" },
  { label: "Green", color: "#2e7d32" },
  { label: "Deep Orange", color: "#d84315" },
  { label: "Red", color: "#c62828" },
  { label: "Blue Grey", color: "#37474f" },
];

// Local cache only, so the UI has something to paint before the session/user
// loads (or when logged out, e.g. on the login page). The source of truth is
// the logged-in user's themeColor field on the server — see AppearanceSection
// and ThemeRegistry, which sync this cache from/to that field.
export function getStoredBannerColor(): string {
  if (typeof window === "undefined") return DEFAULT_BANNER_COLOR;
  return window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_BANNER_COLOR;
}

export function setStoredBannerColor(color: string) {
  window.localStorage.setItem(THEME_STORAGE_KEY, color);
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
}

export function createAppTheme(bannerColor: string): Theme {
  return createTheme({
    palette: {
      mode: "light",
      // Drives every default-colored control (buttons, icons, chips, the
      // AppBar) app-wide, not just the top banner — MUI derives contrastText
      // for all of them automatically from this one value.
      primary: {
        main: bannerColor,
      },
      background: {
        default: "#f4f7f7",
        paper: "#ffffff",
      },
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: "var(--font-roboto), Roboto, Helvetica, Arial, sans-serif",
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
          },
        },
      },
    },
  });
}
