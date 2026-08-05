import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";
import AdminUsersTab from "./admin/AdminUsersTab";
import AdminPasswordResetRequestsTab from "./admin/AdminPasswordResetRequestsTab";
import AdminAuditLogTab from "./admin/AdminAuditLogTab";

type TabId = "users" | "password-resets" | "audit-log";

export default function AdminScreen() {
  const [tab, setTab] = useState<TabId>("users");

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>
        Admin
      </Text>
      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        buttons={[
          { value: "users", label: "Users", icon: "account-multiple" },
          { value: "password-resets", label: "Resets", icon: "bell" },
          { value: "audit-log", label: "Audit", icon: "history" },
        ]}
        style={styles.tabs}
      />
      {tab === "users" && <AdminUsersTab />}
      {tab === "password-resets" && <AdminPasswordResetRequestsTab />}
      {tab === "audit-log" && <AdminAuditLogTab />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  title: { marginBottom: 16, fontWeight: "600" },
  tabs: { marginBottom: 8 },
});
