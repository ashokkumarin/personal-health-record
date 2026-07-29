"use client";

import { useEffect, useMemo, useState } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import {
  createAppTheme,
  getStoredBannerColor,
  DEFAULT_BANNER_COLOR,
  THEME_CHANGED_EVENT,
} from "../lib/theme";
import { getCurrentUser, SESSION_CHANGED_EVENT } from "../lib/auth";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

// The logged-in user's themeColor (persisted server-side, see AppearanceSection)
// is the source of truth so the color follows the account across devices.
// The localStorage cache is only a fallback for the logged-out state (e.g. the
// login page, which has no user yet).
function resolveBannerColor(): string {
  return getCurrentUser()?.themeColor ?? getStoredBannerColor();
}

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [bannerColor, setBannerColor] = useState(DEFAULT_BANNER_COLOR);

  useEffect(() => {
    setBannerColor(resolveBannerColor());
    const onChange = () => setBannerColor(resolveBannerColor());
    window.addEventListener(THEME_CHANGED_EVENT, onChange);
    window.addEventListener(SESSION_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, onChange);
      window.removeEventListener(SESSION_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const theme = useMemo(() => createAppTheme(bannerColor), [bannerColor]);

  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <Nav />
          <Box sx={{ flex: 1 }}>{children}</Box>
          <Footer />
        </Box>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
