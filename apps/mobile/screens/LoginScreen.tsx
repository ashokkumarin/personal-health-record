import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { loginSchema, ApiRequestError } from "@phr/shared";
import { useAuthClient } from "../lib/useAuthClient";
import { useAuth } from "../lib/authContext";
import { recordLocalAuditEvent } from "../lib/audit/local";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const authClient = useAuthClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (!authClient) {
      setError("No server configured.");
      return;
    }
    setSubmitting(true);
    try {
      const { user, token } = await authClient.login(parsed.data);
      await login(user, token);
      await recordLocalAuditEvent({ actorType: "USER", eventType: "LOGIN", entityType: "user", entityId: user.id });
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "INVALID_CREDENTIALS") {
        setError("Incorrect email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Log in
        </Text>
        <TextInput
          label="Email"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        {error && (
          <Text style={styles.error} variant="bodyMedium">
            {error}
          </Text>
        )}
        <Button mode="contained" onPress={handleLogin} loading={submitting} style={styles.button}>
          Log in
        </Button>
        <Button onPress={() => navigation.navigate("Register")} style={styles.button}>
          Need an account? Register
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 72, gap: 12 },
  title: { marginBottom: 8 },
  input: {},
  button: { marginTop: 4 },
  error: { color: "#c62828" },
});
