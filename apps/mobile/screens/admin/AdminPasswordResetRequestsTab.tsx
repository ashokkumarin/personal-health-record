import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Dialog, List, Portal, Text, TextInput } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import type { PasswordResetRequestRecord } from "@phr/shared";
import { useApi } from "../../lib/useApi";

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminPasswordResetRequestsTab() {
  const api = useApi();
  const [requests, setRequests] = useState<PasswordResetRequestRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<PasswordResetRequestRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!api) return;
    api.adminClient
      .listPasswordResetRequests()
      .then(setRequests)
      .catch(() => setError("Could not load password reset requests."));
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleResolve() {
    if (!api || !resolving) return;
    setResolveError(null);
    if (newPassword.length < 8) {
      setResolveError("Password must be at least 8 characters.");
      return;
    }
    try {
      await api.adminClient.resolvePasswordResetRequest(resolving.id, { newPassword });
      setResolving(null);
      setNewPassword("");
      load();
    } catch {
      setResolveError("Could not resolve this request.");
    }
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Password Reset Requests
      </Text>
      {error && (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      )}

      {requests?.length === 0 && (
        <Text variant="bodyMedium" style={styles.empty}>
          No pending requests.
        </Text>
      )}
      {requests?.map((request) => (
        <List.Item
          key={request.id}
          title={`${request.user.name} (${request.user.email})`}
          description={`Requested ${formatWhen(request.createdAt)}`}
          right={(p) => (
            <Button {...p} mode="contained" compact onPress={() => setResolving(request)}>
              Resolve
            </Button>
          )}
        />
      ))}

      <Portal>
        <Dialog visible={resolving !== null} onDismiss={() => setResolving(null)}>
          <Dialog.Title>Reset password for {resolving?.user.name}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
              Share this new password with {resolving?.user.name}. They&apos;ll be required to
              change it on their next login.
            </Text>
            <TextInput label="New password" value={newPassword} onChangeText={setNewPassword} />
            {resolveError && (
              <Text variant="bodyMedium" style={styles.error}>
                {resolveError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResolving(null)}>Cancel</Button>
            <Button onPress={handleResolve}>Resolve</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontWeight: "600", marginBottom: 8 },
  error: { color: "#c62828", marginBottom: 8 },
  empty: { opacity: 0.6, paddingVertical: 8 },
});
