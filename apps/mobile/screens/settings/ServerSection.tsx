import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import {
  useServerConfig,
  MIN_SYNC_INTERVAL_MINUTES,
  MAX_SYNC_INTERVAL_MINUTES,
} from "../../lib/serverConfigContext";
import { useSyncContext } from "../../lib/sync/syncContext";

function formatLastSynced(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ServerSection() {
  const serverConfig = useServerConfig();
  const { status, lastResult, lastSyncedAt, sync } = useSyncContext();
  const [url, setUrl] = useState(serverConfig.serverUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intervalInput, setIntervalInput] = useState(String(serverConfig.syncIntervalMinutes));

  useEffect(() => {
    setIntervalInput(String(serverConfig.syncIntervalMinutes));
  }, [serverConfig.syncIntervalMinutes]);

  function handleIntervalBlur() {
    const parsed = Number(intervalInput);
    if (!Number.isFinite(parsed)) {
      setIntervalInput(String(serverConfig.syncIntervalMinutes));
      return;
    }
    serverConfig.setSyncIntervalMinutes(parsed);
  }

  async function handleConnect() {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a server address.");
      return;
    }
    setBusy(true);
    try {
      const normalized = trimmed.replace(/\/+$/, "");
      const res = await fetch(`${normalized}/health`);
      if (!res.ok) throw new Error("unhealthy");
      await serverConfig.setServerUrl(normalized);
      await sync();
    } catch {
      setError("Couldn't reach that server. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (serverConfig.mode === "standalone") {
    return (
      <View>
        <Text variant="titleMedium" style={styles.label}>
          Server
        </Text>
        <Text variant="bodyMedium" style={styles.hint}>
          This device isn&apos;t connected to a server — documents stay on this phone only.
        </Text>
        <TextInput
          label="Server address"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={url}
          onChangeText={setUrl}
          style={styles.field}
          placeholder="http://192.168.1.50:4000"
        />
        {error && (
          <Text variant="bodyMedium" style={styles.error}>
            {error}
          </Text>
        )}
        <Button mode="contained" onPress={handleConnect} loading={busy} style={styles.field}>
          Connect
        </Button>
        <Text variant="bodySmall" style={styles.hint}>
          Documents you&apos;ve already created here will upload automatically once connected.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.label}>
        Server
      </Text>
      <Text variant="bodyMedium" style={styles.hint}>
        Connected to {serverConfig.serverUrl}
      </Text>

      <Text variant="titleMedium" style={styles.label}>
        Sync
      </Text>
      <Text variant="bodyMedium" style={styles.hint}>
        Status: {status === "syncing" ? "Syncing…" : status === "error" ? "Last sync failed" : "Up to date"}
      </Text>
      <Text variant="bodyMedium" style={styles.hint}>
        Last synced: {formatLastSynced(lastSyncedAt)}
      </Text>
      <TextInput
        label="Sync every (minutes)"
        keyboardType="numeric"
        value={intervalInput}
        onChangeText={setIntervalInput}
        onBlur={handleIntervalBlur}
        style={styles.field}
      />
      <Text variant="bodySmall" style={styles.hint}>
        {MIN_SYNC_INTERVAL_MINUTES}–{MAX_SYNC_INTERVAL_MINUTES} minutes
      </Text>
      {lastResult?.error && (
        <Text variant="bodySmall" style={styles.error}>
          {lastResult.error}
        </Text>
      )}
      <Button mode="outlined" onPress={() => sync()} loading={status === "syncing"} style={styles.field}>
        Sync now
      </Button>

      <Text variant="titleMedium" style={styles.label}>
        Change server
      </Text>
      <TextInput
        label="Server address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={url}
        onChangeText={setUrl}
        style={styles.field}
        placeholder="http://192.168.1.50:4000"
      />
      {error && (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      )}
      <Button mode="contained" onPress={handleConnect} loading={busy} style={styles.field}>
        Connect to this server instead
      </Button>
      <Text variant="bodySmall" style={styles.hint}>
        Switching servers re-downloads everything from the new one. Anything created here that
        hasn&apos;t synced to the current server yet will not carry over.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 8, fontWeight: "600" },
  hint: { opacity: 0.7, marginBottom: 8 },
  field: { marginBottom: 12 },
  error: { color: "#c62828", marginBottom: 8 },
});
