import { useEffect, useRef, useState } from "react";
import { Image, PanResponder, StyleSheet, View } from "react-native";
import { ActivityIndicator, Appbar, Button, Icon, Snackbar, Text } from "react-native-paper";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MedicalRecord } from "@phr/shared";
import { useApi } from "../lib/useApi";
import { downloadAndShareRecord } from "../lib/download";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "RecordViewer">;

const SWIPE_THRESHOLD = 60;

export default function RecordViewerScreen({ route, navigation }: Props) {
  const { recordIds } = route.params;
  const [index, setIndex] = useState(route.params.index);
  const recordId = recordIds[index];
  const api = useApi();
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    setRecord(null);
    setError(null);
    api.recordsClient
      .getRecord(recordId)
      .then((r) => {
        setRecord(r);
        navigation.setOptions({ title: r.title });
      })
      .catch(() => setError("Could not load this document."));
  }, [api, recordId, navigation]);

  async function handleDownload() {
    if (!api || !record || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadAndShareRecord(api.recordsClient, record);
    } catch {
      setDownloadError("Could not download this document.");
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    navigation.setOptions({
      headerRight: ({ tintColor }) =>
        downloading ? (
          <ActivityIndicator size={20} style={styles.headerLoading} />
        ) : (
          <Appbar.Action icon="download" color={tintColor} onPress={handleDownload} disabled={!record} />
        ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, downloading, record]);

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    setIndex((i) => Math.min(recordIds.length - 1, i + 1));
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx <= -SWIPE_THRESHOLD) {
          goNext();
        } else if (gesture.dx >= SWIPE_THRESHOLD) {
          goPrev();
        }
      },
    })
  ).current;

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {record.fileType === "application/pdf" ? (
        <View style={styles.center} {...panResponder.panHandlers}>
          <Icon source="file-pdf-box" size={72} color="#c62828" />
          <Text variant="titleMedium" style={styles.pdfTitle}>
            {record.title}
          </Text>
          <Text variant="bodyMedium" style={styles.pdfHint}>
            PDFs open in your device&apos;s viewer.
          </Text>
          <Button mode="contained" onPress={handleDownload} loading={downloading} style={styles.pdfButton}>
            Open / Download
          </Button>
        </View>
      ) : (
        <View style={styles.imageContainer} {...panResponder.panHandlers}>
          {record.downloadUrl && (
            <Image source={{ uri: record.downloadUrl }} style={styles.image} resizeMode="contain" />
          )}
        </View>
      )}
      <Snackbar visible={Boolean(downloadError)} onDismiss={() => setDownloadError(null)} duration={4000}>
        {downloadError}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c62828" },
  imageContainer: { flex: 1, backgroundColor: "#000" },
  image: { flex: 1 },
  pdfTitle: { marginTop: 16, textAlign: "center" },
  pdfHint: { marginTop: 4, opacity: 0.6, textAlign: "center" },
  pdfButton: { marginTop: 24 },
  headerLoading: { marginRight: 16 },
});
