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

function readableTextColor(hex: string): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "#ffffff";
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

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
      primary: {
        main: "#00695c",
      },
      // Follows the customizable banner color so the initial-letter avatar
      // fallback (the only real use of palette.secondary.main) always
      // matches the current theme rather than staying a fixed color.
      secondary: {
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
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: bannerColor,
            color: readableTextColor(bannerColor),
          },
        },
      },
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
