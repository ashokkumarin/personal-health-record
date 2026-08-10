import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createLocalFamilyMember } from "../lib/data/families";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "AddFamilyMember">;

export default function AddFamilyMemberScreen({ route, navigation }: Props) {
  const { familyId } = route.params;
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createLocalFamilyMember(familyId, { name: name.trim(), relation: relation.trim() || undefined });
      navigation.goBack();
    } catch {
      setError("Could not add this family member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="bodyMedium" style={styles.hint}>
        This device is offline — this member is managed locally and won&apos;t have their own login.
      </Text>
      <TextInput label="Name" value={name} onChangeText={setName} style={styles.field} />
      <TextInput label="Relation" value={relation} onChangeText={setRelation} style={styles.field} />
      {error && (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      )}
      <Button mode="contained" onPress={handleSave} loading={saving}>
        Save
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  hint: { opacity: 0.7, marginBottom: 16 },
  field: { marginBottom: 12 },
  error: { color: "#c62828", marginBottom: 12 },
});
