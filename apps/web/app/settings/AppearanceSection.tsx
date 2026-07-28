"use client";

import { useEffect, useState } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CheckIcon from "@mui/icons-material/Check";
import {
  BANNER_COLOR_PRESETS,
  DEFAULT_BANNER_COLOR,
  getStoredBannerColor,
  setStoredBannerColor,
} from "../../lib/theme";

export default function AppearanceSection() {
  const [bannerColor, setBannerColor] = useState(DEFAULT_BANNER_COLOR);

  useEffect(() => {
    setBannerColor(getStoredBannerColor());
  }, []);

  function applyColor(color: string) {
    setBannerColor(color);
    setStoredBannerColor(color);
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
            Choose the color of the top navigation bar.
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
        </CardContent>
      </Card>
    </>
  );
}
