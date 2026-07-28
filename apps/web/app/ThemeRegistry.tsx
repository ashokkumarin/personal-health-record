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
import Nav from "./components/Nav";
import Footer from "./components/Footer";

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [bannerColor, setBannerColor] = useState(DEFAULT_BANNER_COLOR);

  useEffect(() => {
    setBannerColor(getStoredBannerColor());
    const onChange = () => setBannerColor(getStoredBannerColor());
    window.addEventListener(THEME_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, onChange);
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
