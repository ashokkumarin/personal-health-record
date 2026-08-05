import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";
import FamilyGroupsSection from "./settings/FamilyGroupsSection";
import AppearanceSection from "./settings/AppearanceSection";
import ServerSection from "./settings/ServerSection";

type SectionId = "family-groups" | "appearance" | "server";

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
          { value: "server", label: "Server", icon: "server" },
        ]}
        style={styles.tabs}
      />
      {section === "family-groups" && <FamilyGroupsSection />}
      {section === "appearance" && <AppearanceSection />}
      {section === "server" && <ServerSection />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  title: { marginBottom: 16, fontWeight: "600" },
  tabs: { marginBottom: 8 },
});
