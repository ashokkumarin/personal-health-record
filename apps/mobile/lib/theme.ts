import { MD3LightTheme, type MD3Theme } from "react-native-paper";

export const DEFAULT_BANNER_COLOR = "#00695c";

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

export function createAppTheme(bannerColor: string): MD3Theme {
  return {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: bannerColor,
      onPrimary: "#ffffff",
      background: "#f4f7f7",
    },
  };
}
