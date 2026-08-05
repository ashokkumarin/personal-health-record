import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { registerSchema, ApiRequestError } from "@phr/shared";
import { useAuthClient } from "../lib/useAuthClient";
import { recordLocalAuditEvent } from "../lib/audit/local";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const authClient = useAuthClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setError(null);
    const parsed = registerSchema.safeParse({ name, email, password });
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
      const { user } = await authClient.register(parsed.data);
      await recordLocalAuditEvent({ actorType: "USER", eventType: "REGISTER", entityType: "user", entityId: user.id });
      setSuccess(true);
      navigation.navigate("Login");
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") {
        setError("An account with this email already exists.");
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
          Create an account
        </Text>
        <TextInput label="Name" value={name} onChangeText={setName} style={styles.input} />
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
        {success && (
          <Text variant="bodyMedium" style={styles.success}>
            Account created — please log in.
          </Text>
        )}
        <Button mode="contained" onPress={handleRegister} loading={submitting} style={styles.button}>
          Register
        </Button>
        <Button onPress={() => navigation.navigate("Login")} style={styles.button}>
          Already have an account? Log in
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
  success: { color: "#2e7d32" },
});
