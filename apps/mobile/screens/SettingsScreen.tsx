import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";
import FamilyGroupsSection from "./settings/FamilyGroupsSection";
import AppearanceSection from "./settings/AppearanceSection";

type SectionId = "family-groups" | "appearance";

export default function SettingsScreen() {
  const [section, setSection] = useState<SectionId>("family-groups");

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>
        Settings
      </Text>
      <SegmentedButtons
        value={section}
        onValueChange={(v) => setSection(v as SectionId)}
        buttons={[
          { value: "family-groups", label: "Family Groups", icon: "account-group" },
          { value: "appearance", label: "Appearance", icon: "palette" },
        ]}
        style={styles.tabs}
      />
      {section === "family-groups" ? <FamilyGroupsSection /> : <AppearanceSection />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  title: { marginBottom: 16, fontWeight: "600" },
  tabs: { marginBottom: 8 },
});
