import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";
import { useApi } from "../../lib/useApi";
import { useAuth } from "../../lib/authContext";
import { BANNER_COLOR_PRESETS, DEFAULT_BANNER_COLOR } from "../../lib/theme";

export default function AppearanceSection() {
  const api = useApi();
  const { user, setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [timelineViewError, setTimelineViewError] = useState<string | null>(null);

  const bannerColor = user?.themeColor ?? DEFAULT_BANNER_COLOR;
  const timelineView = user?.defaultTimelineView ?? "grid";

  async function applyColor(color: string) {
    if (!api) return;
    setError(null);
    try {
      const updated = await api.userClient.updateProfile({ themeColor: color });
      await setUser(updated);
    } catch {
      setError("Could not save your theme color. Please try again.");
    }
  }

  async function applyTimelineView(view: "grid" | "list") {
    if (!api) return;
    setTimelineViewError(null);
    try {
      const updated = await api.userClient.updateProfile({ defaultTimelineView: view });
      await setUser(updated);
    } catch {
      setTimelineViewError("Could not save this setting. Please try again.");
    }
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.label}>
        Top banner color
      </Text>
      <View style={styles.swatchRow}>
        {BANNER_COLOR_PRESETS.map((preset) => {
          const selected = preset.color.toLowerCase() === bannerColor.toLowerCase();
          return (
            <TouchableOpacity
              key={preset.color}
              onPress={() => applyColor(preset.color)}
              style={[
                styles.swatch,
                { backgroundColor: preset.color },
                selected && styles.swatchSelected,
              ]}
            >
              {selected && (
                <Text variant="labelLarge" style={styles.swatchCheck}>
                  ✓
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {error && (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      )}

      <Text variant="titleMedium" style={styles.label}>
        Default health record view
      </Text>
      <SegmentedButtons
        value={timelineView}
        onValueChange={(v) => applyTimelineView(v as "grid" | "list")}
        buttons={[
          { value: "grid", label: "Thumbnail", icon: "view-grid" },
          { value: "list", label: "List", icon: "view-list" },
        ]}
      />
      {timelineViewError && (
        <Text variant="bodyMedium" style={styles.error}>
          {timelineViewError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 12, fontWeight: "600" },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: { borderWidth: 2, borderColor: "#000" },
  swatchCheck: { color: "#fff" },
  error: { color: "#c62828", marginTop: 8 },
});
