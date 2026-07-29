"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import { useTheme, alpha } from "@mui/material/styles";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { getCurrentUser, clearSession, SESSION_CHANGED_EVENT } from "../../lib/auth";
import { familyClient, APPROVALS_CHANGED_EVENT } from "../../lib/api";
import Sidebar from "./Sidebar";
import LogoMark from "./LogoMark";

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  // primary.main tracks the user's customizable banner/app-bar color (see
  // theme.ts) — border the avatar in a translucent version of that color's
  // contrast text so it reads as a subtle outline rather than blending into
  // the app bar, regardless of which banner color is picked.
  const avatarBorderColor = alpha(theme.palette.primary.contrastText, 0.5);
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const refreshUser = useCallback(() => {
    const user = getCurrentUser();
    setUserName(user?.name ?? null);
    setAvatarUrl(user?.avatarUrl ?? null);
  }, []);

  // Nav lives in the root layout and never remounts on client-side
  // navigation, so re-read the stored session on every route change —
  // otherwise logging out and back in as a different account leaves this
  // showing the previous session's cached name.
  useEffect(() => {
    refreshUser();
  }, [refreshUser, pathname]);

  useEffect(() => {
    window.addEventListener(SESSION_CHANGED_EVENT, refreshUser);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, refreshUser);
  }, [refreshUser]);

  const refreshApprovals = useCallback(() => {
    if (!getCurrentUser()) return;
    familyClient()
      .listApprovals()
      .then((list) => setPendingApprovals(list.length))
      .catch(() => setPendingApprovals(0));
  }, []);

  useEffect(() => {
    refreshApprovals();
  }, [refreshApprovals, userName, pathname]);

  useEffect(() => {
    window.addEventListener(APPROVALS_CHANGED_EVENT, refreshApprovals);
    return () => window.removeEventListener(APPROVALS_CHANGED_EVENT, refreshApprovals);
  }, [refreshApprovals]);

  if (!userName) return null;

  function handleLogout() {
    setAnchorEl(null);
    clearSession();
    // Hard navigation, same reasoning as login: forces every page component
    // to remount fresh rather than reusing stale state from this session.
    window.location.href = "/login";
  }

  function go(path: string) {
    setAnchorEl(null);
    router.push(path);
  }

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ top: 0 }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton color="inherit" onClick={() => setSidebarOpen(true)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: "flex", alignItems: "center", mr: 1, color: "inherit" }}>
            <LogoMark size={32} />
          </Box>
          <Typography
            variant="h6"
            component={Link}
            href="/"
            sx={{ color: "inherit", textDecoration: "none", flexGrow: 1 }}
          >
            PHR
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <IconButton
              color="inherit"
              disabled={pendingApprovals === 0}
              onClick={() => router.push("/approvals")}
            >
              <Badge badgeContent={pendingApprovals} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 1 }}>
              <Avatar
                src={avatarUrl ?? undefined}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: "secondary.main",
                  border: "2px solid",
                  borderColor: avatarBorderColor,
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled sx={{ opacity: "1 !important" }}>
                {userName}
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => go("/profile")}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem onClick={() => go("/settings")}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Log out
              </MenuItem>
            </Menu>
          </Stack>
        </Toolbar>
      </AppBar>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
