import { useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Avatar, Button, Divider, SegmentedButtons, Text, TextInput } from "react-native-paper";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { changePasswordSchema, updateProfileSchema, ApiRequestError } from "@phr/shared";
import { useApi } from "../lib/useApi";
import { useAuth } from "../lib/authContext";

type TabId = "personal" | "security";

function formatDob(value: string): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function ProfileScreen() {
  const api = useApi();
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState<TabId>("personal");

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth?.slice(0, 10) ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!api) return;
    api.userClient
      .getMe()
      .then((fresh) => {
        setName(fresh.name);
        setEmail(fresh.email);
        setPhone(fresh.phone ?? "");
        setDateOfBirth(fresh.dateOfBirth?.slice(0, 10) ?? "");
        setAddress(fresh.address ?? "");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  function openDatePicker() {
    const current = dateOfBirth ? new Date(dateOfBirth) : new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event, selected) => {
          if (event.type === "set" && selected) {
            setDateOfBirth(selected.toISOString().slice(0, 10));
          }
        },
      });
    } else {
      setIosPickerOpen(true);
    }
  }

  async function handleSaveProfile() {
    if (!api) return;
    setProfileError(null);
    setProfileSuccess(false);
    const parsed = updateProfileSchema.safeParse({
      name,
      email,
      phone: phone || undefined,
      dateOfBirth: dateOfBirth || undefined,
      address: address || undefined,
    });
    if (!parsed.success) {
      setProfileError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await api.userClient.updateProfile(parsed.data);
      await setUser(updated);
      setProfileSuccess(true);
    } catch {
      setProfileError("Could not save your profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePickAvatar() {
    if (!api) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const updated = await api.userClient.uploadPhoto({
        uri: asset.uri,
        name: asset.fileName ?? "avatar.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      await setUser(updated);
    } catch {
      setProfileError("Could not upload photo.");
    }
  }

  async function handleChangePassword() {
    if (!api) return;
    setPasswordError(null);
    setPasswordSuccess(false);
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSavingPassword(true);
    try {
      await api.userClient.changePassword(parsed.data);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "INVALID_CREDENTIALS") {
        setPasswordError("Current password is incorrect.");
      } else {
        setPasswordError("Could not change your password.");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>
        Profile
      </Text>

      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        buttons={[
          { value: "personal", label: "Personal Info", icon: "account" },
          { value: "security", label: "Security", icon: "lock" },
        ]}
        style={styles.tabs}
      />

      {tab === "personal" && (
        <View>
          <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrap}>
            {user?.avatarUrl ? (
              <Avatar.Image size={72} source={{ uri: user.avatarUrl }} />
            ) : (
              <Avatar.Text size={72} label={(user?.name ?? "?").charAt(0).toUpperCase()} />
            )}
            <Text variant="bodySmall" style={{ marginTop: 4 }}>
              Change photo
            </Text>
          </TouchableOpacity>

          <TextInput label="Name" value={name} onChangeText={setName} style={styles.field} />
          <TextInput
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.field}
          />
          <TextInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.field}
          />

          <TouchableOpacity onPress={openDatePicker}>
            <TextInput
              label="Date of birth"
              value={formatDob(dateOfBirth)}
              editable={false}
              right={<TextInput.Icon icon="calendar" onPress={openDatePicker} />}
              style={styles.field}
              pointerEvents="none"
            />
          </TouchableOpacity>

          <TextInput
            label="Address"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={4}
            style={[styles.field, styles.addressField]}
          />

          {profileError && (
            <Text variant="bodyMedium" style={styles.error}>
              {profileError}
            </Text>
          )}
          {profileSuccess && (
            <Text variant="bodyMedium" style={styles.success}>
              Profile saved.
            </Text>
          )}
          <Button mode="contained" onPress={handleSaveProfile} loading={savingProfile}>
            Save
          </Button>
        </View>
      )}

      {tab === "security" && (
        <View>
          <Divider style={{ marginBottom: 16 }} />
          <TextInput
            label="Current password"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            style={styles.field}
          />
          <TextInput
            label="New password"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            style={styles.field}
          />
          {passwordError && (
            <Text variant="bodyMedium" style={styles.error}>
              {passwordError}
            </Text>
          )}
          {passwordSuccess && (
            <Text variant="bodyMedium" style={styles.success}>
              Password changed.
            </Text>
          )}
          <Button mode="contained" onPress={handleChangePassword} loading={savingPassword}>
            Change password
          </Button>
        </View>
      )}

      {Platform.OS === "ios" && (
        <Modal visible={iosPickerOpen} transparent animationType="slide">
          <View style={styles.iosPickerBackdrop}>
            <View style={styles.iosPickerSheet}>
              <DateTimePicker
                value={dateOfBirth ? new Date(dateOfBirth) : new Date()}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_event, selected) => {
                  if (selected) setDateOfBirth(selected.toISOString().slice(0, 10));
                }}
              />
              <Button mode="contained" onPress={() => setIosPickerOpen(false)}>
                Done
              </Button>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  title: { marginBottom: 16, fontWeight: "600" },
  tabs: { marginBottom: 16 },
  avatarWrap: { alignItems: "center", marginBottom: 16 },
  field: { marginBottom: 12 },
  addressField: { minHeight: 100 },
  error: { color: "#c62828", marginBottom: 12 },
  success: { color: "#2e7d32", marginBottom: 12 },
  iosPickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" },
  iosPickerSheet: { backgroundColor: "#fff", padding: 16, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
});
