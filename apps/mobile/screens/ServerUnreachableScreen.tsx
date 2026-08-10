import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { Button, Text } from "react-native-paper";
import { useServerConfig } from "../lib/serverConfigContext";

export default function ServerUnreachableScreen() {
  const serverConfig = useServerConfig();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Can't reach your server
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {serverConfig.serverUrl} isn't responding. Make sure your phone is on the same
          network as your server and try again.
        </Text>
        <Button mode="contained" onPress={() => serverConfig.recheckServer()} style={styles.button}>
          Try again
        </Button>
        <Button mode="outlined" onPress={() => serverConfig.reset()} style={styles.button}>
          Change server address
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 72, gap: 8 },
  title: { marginBottom: 4 },
  subtitle: { color: "#555", marginBottom: 16 },
  button: { marginTop: 4 },
});
