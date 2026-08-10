import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Dialog, IconButton, List, Portal, Text, TextInput } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import type { Family } from "@phr/shared";
import { ApiRequestError } from "@phr/shared";
import { useApi } from "../../lib/useApi";

export default function FamilyGroupsSection() {
  const api = useApi();
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Family | null>(null);

  const load = useCallback(() => {
    if (!api) return;
    api.familyClient
      .listFamilies()
      .then(setFamilies)
      .catch(() => setError("Could not load family groups."));
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleCreate() {
    if (!api || !name.trim()) return;
    setError(null);
    try {
      await api.familyClient.createFamily({ name });
      setName("");
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "FAMILY_NAME_TAKEN") {
        setError("A family with this name already exists.");
      } else {
        setError("Could not create family group. Please try again.");
      }
    }
  }

  async function handleSaveRename() {
    if (!api || !editingId) return;
    setError(null);
    try {
      await api.familyClient.renameFamily(editingId, editValue);
      setEditingId(null);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "FAMILY_NAME_TAKEN") {
        setError("A family with this name already exists.");
      } else {
        setError("Could not rename this family group.");
      }
    }
  }

  async function handleConfirmDelete() {
    if (!api || !pendingDelete) return;
    setError(null);
    try {
      await api.familyClient.deleteFamily(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch {
      setError("Could not delete this family group.");
      setPendingDelete(null);
    }
  }

  if (!api) {
    return (
      <View>
        <Text variant="bodyMedium" style={styles.empty}>
          You&apos;re using this device offline with a default family. Connect to a server (Server tab)
          to create or manage multiple family groups.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {error && (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      )}

      {families && families.length > 0 ? (
        families.map((family) => {
          const canManage = family.myRole === "OWNER" || family.myRole === "ADMIN";
          if (editingId === family.id) {
            return (
              <View key={family.id} style={styles.editRow}>
                <TextInput value={editValue} onChangeText={setEditValue} style={styles.editInput} dense />
                <Button onPress={handleSaveRename}>Save</Button>
                <Button onPress={() => setEditingId(null)}>Cancel</Button>
              </View>
            );
          }
          return (
            <List.Item
              key={family.id}
              title={family.name}
              left={(p) => <List.Icon {...p} icon="account-group" />}
              right={
                canManage
                  ? (p) => (
                      <View style={{ flexDirection: "row" }}>
                        <IconButton
                          {...p}
                          icon="pencil"
                          size={18}
                          onPress={() => {
                            setEditingId(family.id);
                            setEditValue(family.name);
                          }}
                        />
                        <IconButton
                          {...p}
                          icon="delete"
                          size={18}
                          iconColor="#c62828"
                          onPress={() => setPendingDelete(family)}
                        />
                      </View>
                    )
                  : undefined
              }
            />
          );
        })
      ) : (
        <Text variant="bodyMedium" style={styles.empty}>
          You don&apos;t belong to any family groups yet.
        </Text>
      )}

      <View style={styles.createRow}>
        <TextInput
          label="Family name"
          value={name}
          onChangeText={setName}
          style={styles.createInput}
          dense
        />
        <Button mode="contained" onPress={handleCreate}>
          Create
        </Button>
      </View>

      <Portal>
        <Dialog visible={pendingDelete !== null} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete &quot;{pendingDelete?.name}&quot;?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This removes the family group from your families list. Patient profiles and their
              medical records are not deleted and remain accessible.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingDelete(null)}>Cancel</Button>
            <Button textColor="#c62828" onPress={handleConfirmDelete}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: "#c62828", marginBottom: 8 },
  empty: { opacity: 0.6, paddingVertical: 8 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  editInput: { flex: 1 },
  createRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  createInput: { flex: 1 },
});
