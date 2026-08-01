"use client";

import { useEffect, useState } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Alert from "@mui/material/Alert";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import CheckIcon from "@mui/icons-material/Check";
import GridViewIcon from "@mui/icons-material/GridView";
import ViewListIcon from "@mui/icons-material/ViewList";
import { BANNER_COLOR_PRESETS, DEFAULT_BANNER_COLOR, setStoredBannerColor } from "../../lib/theme";
import { getCurrentUser, updateStoredUser } from "../../lib/auth";
import { userClient } from "../../lib/api";

const DEFAULT_TIMELINE_VIEW = "grid";

export default function AppearanceSection() {
  const [bannerColor, setBannerColor] = useState(DEFAULT_BANNER_COLOR);
  const [timelineView, setTimelineView] = useState<"grid" | "list">(DEFAULT_TIMELINE_VIEW);
  const [error, setError] = useState<string | null>(null);
  const [timelineViewError, setTimelineViewError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCurrentUser();
    if (cached?.themeColor) setBannerColor(cached.themeColor);
    if (cached?.defaultTimelineView) setTimelineView(cached.defaultTimelineView);
    // Server is the source of truth so these follow the account across
    // devices — a cached session (e.g. from before these settings existed)
    // might not have them yet, so refresh from GET /users/me too.
    userClient()
      .getMe()
      .then((user) => {
        if (user.themeColor) setBannerColor(user.themeColor);
        if (user.defaultTimelineView) setTimelineView(user.defaultTimelineView);
      })
      .catch(() => {});
  }, []);

  async function applyColor(color: string) {
    setError(null);
    setBannerColor(color);
    // Instant local feedback (this tab and this device) while the server
    // save is in flight.
    setStoredBannerColor(color);

    try {
      const user = await userClient().updateProfile({ themeColor: color });
      updateStoredUser(user);
    } catch {
      setError("Could not save your theme color. It will only apply on this device for now.");
    }
  }

  async function applyTimelineView(view: "grid" | "list") {
    setTimelineViewError(null);
    setTimelineView(view);

    try {
      const user = await userClient().updateProfile({ defaultTimelineView: view });
      updateStoredUser(user);
    } catch {
      setTimelineViewError("Could not save this setting. Please try again.");
    }
  }

  return (
    <>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Appearance
      </Typography>

      <Card variant="outlined">
        <CardHeader title="Top banner color" titleTypographyProps={{ variant: "h6" }} />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose the color of the top navigation bar and buttons throughout the app. Saved to
            your account, so it follows you on any device.
          </Typography>

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", mb: 3 }}>
            {BANNER_COLOR_PRESETS.map((preset) => {
              const selected = preset.color.toLowerCase() === bannerColor.toLowerCase();
              return (
                <ButtonBase
                  key={preset.color}
                  onClick={() => applyColor(preset.color)}
                  title={preset.label}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    bgcolor: preset.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    outline: selected ? "2px solid" : "none",
                    outlineColor: "text.primary",
                    outlineOffset: "2px",
                  }}
                >
                  {selected && <CheckIcon sx={{ color: "#fff", fontSize: 20 }} />}
                </ButtonBase>
              );
            })}
          </Stack>

          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Box
              component="input"
              type="color"
              value={bannerColor}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => applyColor(e.target.value)}
              sx={{
                width: 48,
                height: 40,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 0.5,
                cursor: "pointer",
              }}
            />
            <Typography variant="body2" color="text.secondary">
              Custom color ({bannerColor})
            </Typography>
          </Stack>

          {error && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardHeader title="Default health record view" titleTypographyProps={{ variant: "h6" }} />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose how documents appear by default when you open a health record.
          </Typography>

          <ToggleButtonGroup
            value={timelineView}
            exclusive
            onChange={(_e, next) => next && applyTimelineView(next)}
          >
            <ToggleButton value="grid">
              <GridViewIcon fontSize="small" sx={{ mr: 1 }} />
              Thumbnail
            </ToggleButton>
            <ToggleButton value="list">
              <ViewListIcon fontSize="small" sx={{ mr: 1 }} />
              List
            </ToggleButton>
          </ToggleButtonGroup>

          {timelineViewError && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {timelineViewError}
            </Alert>
          )}
        </CardContent>
      </Card>
    </>
  );
}
