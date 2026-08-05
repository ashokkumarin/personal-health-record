import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { recordTypes, recordTypeLabels, type RecordType } from "@phr/shared";
import { useAuth } from "../lib/authContext";
import { createLocalRecord } from "../lib/data/records";
import { listLocalPatientsForFamily, type LocalPatientSummary } from "../lib/data/families";
import { recordLocalAuditEvent } from "../lib/audit/local";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "Upload">;

type PickedFile = { uri: string; name: string; type: string };

export default function UploadScreen({ route, navigation }: Props) {
  const { familyId, patientId } = route.params;
  const { user } = useAuth();
  const [patients, setPatients] = useState<LocalPatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patientId ?? null);
  const [recordType, setRecordType] = useState<RecordType>("PRESCRIPTION");
  const [title, setTitle] = useState("");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (patientId) return;
    listLocalPatientsForFamily(familyId)
      .then(setPatients)
      .catch(() => setError("Could not load patients."));
  }, [familyId, patientId]);

  async function pickImage() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false });
    if (result.canceled) return;
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
    if (!user || !selectedPatientId || !pickedFile || !title.trim()) {
      setError("Choose a patient, a file, and a title.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Always written locally first — works identically online or offline.
      // If a server is configured, SyncProvider picks up the queued mutation
      // (and the file itself) on its next run; see lib/sync/syncEngine.ts.
      const record = await createLocalRecord(
        user.id,
        selectedPatientId,
        { recordType, title },
        { uri: pickedFile.uri, type: pickedFile.type }
      );
      await recordLocalAuditEvent({
        actorType: "USER",
        eventType: "UPLOAD",
        entityType: "record",
        entityId: record.id,
        metadata: { patientId: selectedPatientId },
      });
      navigation.goBack();
    } catch {
      setError("Could not save this document.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {!patientId && patients.length > 0 && (
        <>
          <Text variant="titleMedium" style={styles.label}>
            Patient
          </Text>
          <SegmentedButtons
            value={selectedPatientId ?? ""}
            onValueChange={setSelectedPatientId}
            buttons={patients.map((p) => ({ value: p.id, label: p.name }))}
            style={styles.field}
          />
        </>
      )}

      <Text variant="titleMedium" style={styles.label}>
        Document type
      </Text>
      <SegmentedButtons
        value={recordType}
        onValueChange={(v) => setRecordType(v as RecordType)}
        buttons={recordTypes.map((t) => ({ value: t, label: recordTypeLabels[t] }))}
        style={styles.field}
      />

      <TextInput label="Title" value={title} onChangeText={setTitle} style={styles.field} />

      <View style={styles.pickers}>
        <Button mode="outlined" onPress={pickImage} style={styles.pickerButton}>
          Take a photo
        </Button>
        <Button mode="outlined" onPress={pickPdf} style={styles.pickerButton}>
          Choose a PDF
        </Button>
      </View>
      {pickedFile && (
        <Text variant="bodyMedium" style={styles.selected}>
          Selected: {pickedFile.name}
        </Text>
      )}

      {error && (
        <Text style={styles.error} variant="bodyMedium">
          {error}
        </Text>
      )}

      <Button mode="contained" onPress={handleUpload} loading={submitting} style={styles.field}>
        Upload
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 4 },
  label: { marginTop: 12, marginBottom: 8, fontWeight: "600" },
  field: { marginBottom: 12 },
  pickers: { flexDirection: "row", gap: 8, marginBottom: 8 },
  pickerButton: { flex: 1 },
  selected: { marginBottom: 12, opacity: 0.7 },
  error: { color: "#c62828", marginBottom: 12 },
});
