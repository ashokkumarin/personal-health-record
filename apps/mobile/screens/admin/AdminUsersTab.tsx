import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  Avatar,
  Button,
  Checkbox,
  Chip,
  Dialog,
  IconButton,
  List,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import type { AdminUser } from "@phr/shared";
import { ApiRequestError } from "@phr/shared";
import { useApi } from "../../lib/useApi";

function formatDob(value: string): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function AdminUsersTab() {
  const api = useApi();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [forceChangePassword, setForceChangePassword] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  const load = useCallback(() => {
    if (!api) return;
    api.adminClient
      .listUsers()
      .then(setUsers)
      .catch(() => setError("Could not load users."));
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleCreate() {
    if (!api) return;
    setCreateError(null);
    if (!createName.trim() || !createEmail.trim() || createPassword.length < 8) {
      setCreateError("Name, email, and an 8+ character password are required.");
      return;
    }
    try {
      await api.adminClient.createUser({
        name: createName,
        email: createEmail,
        password: createPassword,
        forceChangePassword,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setForceChangePassword(true);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") {
        setCreateError("An account with this email already exists.");
      } else {
        setCreateError("Could not create this user.");
      }
    }
  }

  function openEdit(user: AdminUser) {
    setEditing(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone ?? "");
    setEditDateOfBirth(user.dateOfBirth ?? "");
    setEditAddress(user.address ?? "");
    setEditAvatarUrl(user.avatarUrl ?? null);
    setEditError(null);
  }

  function openDatePicker() {
    const current = editDateOfBirth ? new Date(editDateOfBirth) : new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event, selected) => {
          if (event.type === "set" && selected) {
            setEditDateOfBirth(selected.toISOString().slice(0, 10));
          }
        },
      });
    } else {
      setIosPickerOpen(true);
    }
  }

  async function handlePickPhoto() {
    if (!api || !editing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const updated = await api.adminClient.uploadUserPhoto(editing.id, {
        uri: asset.uri,
        name: asset.fileName ?? "avatar.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      setEditAvatarUrl(updated.avatarUrl ?? null);
    } catch {
      setEditError("Could not upload photo.");
    }
  }

  async function handleSaveEdit() {
    if (!api || !editing) return;
    setEditError(null);
    try {
      await api.adminClient.updateUser(editing.id, {
        name: editName,
        email: editEmail,
        phone: editPhone || undefined,
        dateOfBirth: editDateOfBirth || undefined,
        address: editAddress || undefined,
      });
      setEditing(null);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") {
        setEditError("An account with this email already exists.");
      } else {
        setEditError("Could not update this user.");
      }
    }
  }

  async function handleConfirmReset() {
    if (!api || !resetting) return;
    setResetError(null);
    if (resetPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    try {
      await api.adminClient.resetPassword(resetting.id, { newPassword: resetPassword });
      setResetting(null);
      setResetPassword("");
    } catch {
      setResetError("Could not reset this user's password.");
    }
  }

  async function handleConfirmDelete() {
    if (!api || !pendingDelete) return;
    setError(null);
    try {
      await api.adminClient.deleteUser(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "CANNOT_REMOVE_OWNER") {
        setError(
          `${pendingDelete.name} owns a family with other members — transfer or delete that family first.`
        );
      } else if (err instanceof ApiRequestError && err.body.error === "CANNOT_DELETE_SELF") {
        setError("You can't delete your own account.");
      } else if (err instanceof ApiRequestError && err.body.error === "CANNOT_MODIFY_ADMIN") {
        setError("System admin accounts can't be deleted from here.");
      } else {
        setError("Could not delete this user.");
      }
      setPendingDelete(null);
    }
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Users
        </Text>
        <Button mode="contained" icon="plus" onPress={() => setCreateOpen(true)}>
          Add
        </Button>
      </View>
      {error && (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      )}

      {users?.map((user) => (
        <List.Item
          key={user.id}
          title={() => (
            <View style={styles.titleRow}>
              <Text variant="bodyLarge">{user.name}</Text>
              {user.isAdmin && (
                <Chip compact textStyle={styles.chipText}>
                  Admin
                </Chip>
              )}
              {user.mustChangePassword && (
                <Chip compact textStyle={styles.chipText}>
                  Must change pw
                </Chip>
              )}
            </View>
          )}
          description={`${user.email}${
            user.families.length > 0 ? ` · ${user.families.map((f) => f.name).join(", ")}` : ""
          }`}
          left={(p) =>
            user.avatarUrl ? (
              <Avatar.Image {...p} size={40} source={{ uri: user.avatarUrl }} />
            ) : (
              <Avatar.Text {...p} size={40} label={user.name.charAt(0).toUpperCase()} />
            )
          }
          right={(p) =>
            user.isAdmin ? (
              <IconButton {...p} icon="lock" disabled />
            ) : (
              <View style={{ flexDirection: "row" }}>
                <IconButton {...p} icon="key" size={18} onPress={() => setResetting(user)} />
                <IconButton {...p} icon="pencil" size={18} onPress={() => openEdit(user)} />
                <IconButton
                  {...p}
                  icon="delete"
                  size={18}
                  iconColor="#c62828"
                  onPress={() => setPendingDelete(user)}
                />
              </View>
            )
          }
        />
      ))}

      <Portal>
        <Dialog visible={createOpen} onDismiss={() => setCreateOpen(false)}>
          <Dialog.Title>Add user</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={createName} onChangeText={setCreateName} style={styles.field} />
            <TextInput
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={createEmail}
              onChangeText={setCreateEmail}
              style={styles.field}
            />
            <TextInput
              label="Temporary password"
              secureTextEntry
              value={createPassword}
              onChangeText={setCreatePassword}
              style={styles.field}
            />
            <Checkbox.Item
              label="Force password change on first login"
              status={forceChangePassword ? "checked" : "unchecked"}
              onPress={() => setForceChangePassword((v) => !v)}
              style={styles.checkboxItem}
            />
            {createError && (
              <Text variant="bodyMedium" style={styles.error}>
                {createError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateOpen(false)}>Cancel</Button>
            <Button onPress={handleCreate}>Create</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={editing !== null} onDismiss={() => setEditing(null)} style={styles.editDialog}>
          <Dialog.Title>Edit user</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.editScroll}>
              <TouchableOpacity onPress={handlePickPhoto} style={styles.avatarWrap}>
                {editAvatarUrl ? (
                  <Avatar.Image size={64} source={{ uri: editAvatarUrl }} />
                ) : (
                  <Avatar.Text size={64} label={(editName || "?").charAt(0).toUpperCase()} />
                )}
                <Text variant="bodySmall" style={{ marginTop: 4 }}>
                  Change photo
                </Text>
              </TouchableOpacity>
              <TextInput label="Name" value={editName} onChangeText={setEditName} style={styles.field} />
              <TextInput
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={editEmail}
                onChangeText={setEditEmail}
                style={styles.field}
              />
              <TextInput
                label="Mobile number"
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                style={styles.field}
              />
              <TouchableOpacity onPress={openDatePicker}>
                <TextInput
                  label="Date of birth"
                  value={formatDob(editDateOfBirth)}
                  editable={false}
                  right={<TextInput.Icon icon="calendar" onPress={openDatePicker} />}
                  style={styles.field}
                  pointerEvents="none"
                />
              </TouchableOpacity>
              <TextInput
                label="Address"
                value={editAddress}
                onChangeText={setEditAddress}
                multiline
                numberOfLines={3}
                style={styles.field}
              />
              {editing && editing.families.length > 0 && (
                <View style={styles.chipsWrap}>
                  <Text variant="labelSmall" style={{ opacity: 0.6, marginBottom: 4 }}>
                    Family groups
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {editing.families.map((f) => (
                      <Chip key={f.id} compact>
                        {f.name} ({f.role})
                      </Chip>
                    ))}
                  </View>
                </View>
              )}
              {editError && (
                <Text variant="bodyMedium" style={styles.error}>
                  {editError}
                </Text>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditing(null)}>Cancel</Button>
            <Button onPress={handleSaveEdit}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={resetting !== null} onDismiss={() => setResetting(null)}>
          <Dialog.Title>Reset password for {resetting?.name}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
              Share this new password with {resetting?.name}. They&apos;ll be required to change it
              on their next login.
            </Text>
            <TextInput
              label="New password"
              value={resetPassword}
              onChangeText={setResetPassword}
              style={styles.field}
            />
            {resetError && (
              <Text variant="bodyMedium" style={styles.error}>
                {resetError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetting(null)}>Cancel</Button>
            <Button onPress={handleConfirmReset}>Reset</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={pendingDelete !== null} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete {pendingDelete?.name}?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This removes their family memberships and their own patient profile/records. Records
              they uploaded for other family members are kept. This can&apos;t be undone from the
              app.
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

      {Platform.OS === "ios" && (
        <Portal>
          <Dialog visible={iosPickerOpen} onDismiss={() => setIosPickerOpen(false)}>
            <Dialog.Content>
              <DateTimePicker
                value={editDateOfBirth ? new Date(editDateOfBirth) : new Date()}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_event, selected) => {
                  if (selected) setEditDateOfBirth(selected.toISOString().slice(0, 10));
                }}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setIosPickerOpen(false)}>Done</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { fontWeight: "600" },
  error: { color: "#c62828", marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  chipText: { fontSize: 11, lineHeight: 14, marginVertical: 4 },
  field: { marginBottom: 12 },
  checkboxItem: { paddingLeft: 0 },
  editDialog: { maxHeight: "85%" },
  editScroll: { paddingBottom: 8 },
  avatarWrap: { alignItems: "center", marginBottom: 12 },
  chipsWrap: { marginBottom: 12 },
});
