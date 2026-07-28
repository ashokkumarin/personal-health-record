import { useState } from "react";
import { SafeAreaView, Text, TextInput, Button, StyleSheet, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  registerSchema,
  loginSchema,
  ApiRequestError,
  createFamilyClient,
  createRecordsClient,
  recordTypes,
  recordTypeLabels,
  type Family,
  type FamilyDetail,
  type MedicalRecord,
  type RecordType,
} from "@phr/shared";
import { authClient, API_URL } from "./lib/api";

type Screen = "register" | "login" | "families" | "familyDetail" | "upload" | "timeline";

type PickedFile = { uri: string; name: string; type: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [families, setFamilies] = useState<Family[]>([]);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<FamilyDetail | null>(null);

  const [uploadPatientId, setUploadPatientId] = useState<string | null>(null);
  const [uploadRecordType, setUploadRecordType] = useState<RecordType>("PRESCRIPTION");
  const [uploadTitle, setUploadTitle] = useState("");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);

  async function handleRegister() {
    setError(null);
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      await authClient.register(parsed.data);
      setScreen("login");
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") {
        setError("An account with this email already exists.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  async function loadFamilies(activeToken: string) {
    const families = await createFamilyClient(API_URL, activeToken).listFamilies();
    setFamilies(families);
  }

  async function handleLogin() {
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      const { token: newToken } = await authClient.login(parsed.data);
      await AsyncStorage.setItem("phr_token", newToken);
      setToken(newToken);
      await loadFamilies(newToken);
      setScreen("families");
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "INVALID_CREDENTIALS") {
        setError("Incorrect email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  async function handleCreateFamily() {
    if (!token || !newFamilyName.trim()) return;
    setError(null);
    try {
      const family = await createFamilyClient(API_URL, token).createFamily({ name: newFamilyName });
      setFamilies((prev) => [...prev, family]);
      setNewFamilyName("");
    } catch {
      setError("Could not create family.");
    }
  }

  async function openFamily(familyId: string) {
    if (!token) return;
    setError(null);
    try {
      const detail = await createFamilyClient(API_URL, token).getFamily(familyId);
      setSelectedFamily(detail);
      setScreen("familyDetail");
    } catch {
      setError("Could not load family.");
    }
  }

  async function pickImage() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: false,
    });
    if (!permission.granted || result.canceled) return;
    const asset = result.assets[0];
    setPickedFile({
      uri: asset.uri,
      name: asset.fileName ?? "photo.jpg",
      type: asset.mimeType ?? "image/jpeg",
    });
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPickedFile({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/pdf" });
  }

  async function handleUpload() {
    if (!token || !uploadPatientId || !pickedFile || !uploadTitle.trim()) {
      setError("Choose a patient, a file, and a title.");
      return;
    }
    setError(null);
    try {
      await createRecordsClient(API_URL, token).uploadRecord(
        uploadPatientId,
        { recordType: uploadRecordType, title: uploadTitle },
        pickedFile
      );
      setUploadTitle("");
      setPickedFile(null);
      setScreen("familyDetail");
    } catch {
      setError("Could not upload this document.");
    }
  }

  async function openTimeline(familyId: string) {
    if (!token) return;
    setError(null);
    try {
      const list = await createRecordsClient(API_URL, token).listRecords(familyId);
      setRecords(list);
      setScreen("timeline");
    } catch {
      setError("Could not load the timeline.");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        {screen === "register" && (
          <>
            <Text style={styles.title}>Create an account</Text>
            <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button title="Register" onPress={handleRegister} />
            <Button title="Already have an account? Log in" onPress={() => setScreen("login")} />
          </>
        )}

        {screen === "login" && (
          <>
            <Text style={styles.title}>Log in</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button title="Log in" onPress={handleLogin} />
            <Button title="Need an account? Register" onPress={() => setScreen("register")} />
          </>
        )}

        {screen === "families" && (
          <>
            <Text style={styles.title}>Your families</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            {families.length === 0 && <Text>You don&apos;t belong to any families yet.</Text>}
            {families.map((family) => (
              <Button key={family.id} title={family.name} onPress={() => openFamily(family.id)} />
            ))}
            <Text style={styles.title}>Create a family</Text>
            <TextInput
              style={styles.input}
              placeholder="Family name"
              value={newFamilyName}
              onChangeText={setNewFamilyName}
            />
            <Button title="Create" onPress={handleCreateFamily} />
          </>
        )}

        {screen === "familyDetail" && selectedFamily && (
          <>
            <Button title="← Back to families" onPress={() => setScreen("families")} />
            <Text style={styles.title}>{selectedFamily.name}</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.subtitle}>Members</Text>
            {selectedFamily.memberships.map((m) => (
              <Text key={m.id}>
                {m.user.name} ({m.user.email}) — {m.role} — {m.status}
              </Text>
            ))}
            <Text style={styles.subtitle}>Patient profiles</Text>
            {selectedFamily.patients.map((p) => (
              <Text key={p.id}>
                {p.name} {p.linkedUserId ? "(linked account)" : "(no account)"}
              </Text>
            ))}
            <Button title="Upload a document" onPress={() => setScreen("upload")} />
            <Button title="View timeline" onPress={() => openTimeline(selectedFamily.id)} />
          </>
        )}

        {screen === "upload" && selectedFamily && (
          <>
            <Button title="← Back" onPress={() => setScreen("familyDetail")} />
            <Text style={styles.title}>Upload a document</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.subtitle}>Patient</Text>
            {selectedFamily.patients.map((p) => (
              <Button
                key={p.id}
                title={`${uploadPatientId === p.id ? "✓ " : ""}${p.name}`}
                onPress={() => setUploadPatientId(p.id)}
              />
            ))}
            <Text style={styles.subtitle}>Document type</Text>
            {recordTypes.map((t) => (
              <Button
                key={t}
                title={`${uploadRecordType === t ? "✓ " : ""}${recordTypeLabels[t]}`}
                onPress={() => setUploadRecordType(t)}
              />
            ))}
            <TextInput
              style={styles.input}
              placeholder="Title"
              value={uploadTitle}
              onChangeText={setUploadTitle}
            />
            <Button title="Take a photo" onPress={pickImage} />
            <Button title="Choose a PDF" onPress={pickPdf} />
            {pickedFile && <Text>Selected: {pickedFile.name}</Text>}
            <Button title="Upload" onPress={handleUpload} />
          </>
        )}

        {screen === "timeline" && (
          <>
            <Button title="← Back" onPress={() => setScreen("familyDetail")} />
            <Text style={styles.title}>Timeline</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            {records.length === 0 && <Text>No records yet.</Text>}
            {records.map((r) => (
              <Text key={r.id}>
                {(r.capturedAt ?? r.uploadedAt).slice(0, 10)} — {recordTypeLabels[r.recordType]} — {r.title}
              </Text>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 4, marginTop: 12 },
  subtitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  error: { color: "red" },
});
