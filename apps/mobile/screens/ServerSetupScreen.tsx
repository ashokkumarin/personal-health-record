import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { Button, Divider, Text, TextInput } from "react-native-paper";
import { useServerConfig } from "../lib/serverConfigContext";

export default function ServerSetupScreen() {
  const serverConfig = useServerConfig();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a server address.");
      return;
    }
    setConnecting(true);
    try {
      const normalized = trimmed.replace(/\/+$/, "");
      const res = await fetch(`${normalized}/health`);
      if (!res.ok) throw new Error("unhealthy");
      await serverConfig.setServerUrl(normalized);
    } catch {
      setError("Couldn't reach that server. Check the address and try again.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Connect to a server
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Enter the address of your Personal Health Record server (e.g. http://192.168.1.50:4000).
        </Text>
        <TextInput
          label="Server address"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={url}
          onChangeText={setUrl}
          style={styles.input}
          placeholder="http://192.168.1.50:4000"
        />
        {error && (
          <Text style={styles.error} variant="bodyMedium">
            {error}
          </Text>
        )}
        <Button mode="contained" onPress={handleConnect} loading={connecting} style={styles.button}>
          Connect
        </Button>

        <Divider style={styles.divider} />

        <Text variant="bodyMedium" style={styles.subtitle}>
          No server? You can use this device on its own — documents stay on this phone only,
          and nothing is shared with anyone else.
        </Text>
        <Button
          mode="outlined"
          onPress={() => serverConfig.setStandalone()}
          style={styles.button}
        >
          Continue offline
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
  input: {},
  button: { marginTop: 4 },
  error: { color: "#c62828" },
  divider: { marginVertical: 20 },
});
