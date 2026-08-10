import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Divider, List, Text } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { FamilyDetail } from "@phr/shared";
import { useApi } from "../lib/useApi";
import { getLocalFamilyDetail } from "../lib/data/families";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "FamilyDetail">;

export default function FamilyDetailScreen({ route, navigation }: Props) {
  const { familyId } = route.params;
  const api = useApi();
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local-only fallback (no server, or the live fetch below failed) — used to
  // decide whether to show the offline "Add family member" action, since the
  // fuller server-backed member-management flow isn't available here.
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setError(null);

      if (!api) {
        setUsingLocalFallback(true);
        getLocalFamilyDetail(familyId)
          .then((local) => (local ? setFamily(local) : setError("Could not load this family.")))
          .catch(() => setError("Could not load this family."));
        return;
      }

      setUsingLocalFallback(false);
      api.familyClient
        .getFamily(familyId)
        .then(setFamily)
        .catch(() => {
          setUsingLocalFallback(true);
          getLocalFamilyDetail(familyId)
            .then((local) => (local ? setFamily(local) : setError("Could not load this family.")))
            .catch(() => setError("Could not load this family."));
        });
    }, [api, familyId])
  );

  if (!family) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>
        {family.name}
      </Text>

      <Text variant="titleMedium" style={styles.section}>
        Members
      </Text>
      <List.Section>
        {family.memberships.map((m) => (
          <List.Item
            key={m.id}
            title={`${m.user.name} (${m.user.email})`}
            description={`${m.role} · ${m.status}`}
            left={(p) => <List.Icon {...p} icon="account" />}
          />
        ))}
      </List.Section>

      <Divider style={{ marginVertical: 8 }} />

      <Text variant="titleMedium" style={styles.section}>
        Patient profiles
      </Text>
      <List.Section>
        {family.patients.map((p) => (
          <List.Item
            key={p.id}
            title={p.name}
            description={p.linkedUserId ? "Linked account" : "No account"}
            left={(props) => <List.Icon {...props} icon="account-heart" />}
          />
        ))}
      </List.Section>

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate("Upload", { familyId: family.id })}
          style={styles.button}
        >
          Upload a document
        </Button>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate("FamilyTimeline", { familyId: family.id })}
          style={styles.button}
        >
          View Health Record
        </Button>
        {usingLocalFallback && (
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("AddFamilyMember", { familyId: family.id })}
            style={styles.button}
          >
            Add family member
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  title: { marginBottom: 16, fontWeight: "600" },
  section: { marginBottom: 4, fontWeight: "600" },
  actions: { marginTop: 16, gap: 8 },
  button: {},
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c62828" },
});
