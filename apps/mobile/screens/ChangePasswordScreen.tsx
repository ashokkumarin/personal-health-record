import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { changePasswordSchema, ApiRequestError } from "@phr/shared";
import { useApi } from "../lib/useApi";
import { useAuth } from "../lib/authContext";

export default function ChangePasswordScreen() {
  const api = useApi();
  const { user, setUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!api || !user) return;
    setError(null);
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    try {
      await api.userClient.changePassword(parsed.data);
      await setUser({ ...user, mustChangePassword: false });
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "INVALID_CREDENTIALS") {
        setError("Your temporary password is incorrect.");
      } else {
        setError("Could not change your password. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Set a new password
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          An admin gave you a temporary password. Choose a new one to continue.
        </Text>
        <TextInput
          label="Temporary password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          style={styles.field}
        />
        <TextInput
          label="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.field}
        />
        {error && (
          <Text variant="bodyMedium" style={styles.error}>
            {error}
          </Text>
        )}
        <Button mode="contained" onPress={handleSubmit} loading={saving}>
          Change password
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 72, gap: 8 },
  title: { marginBottom: 4 },
  subtitle: { color: "#555", marginBottom: 8 },
  field: { marginBottom: 4 },
  error: { color: "#c62828" },
});
