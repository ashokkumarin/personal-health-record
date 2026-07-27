"use client";

import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { theme } from "../lib/theme";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
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
