import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityIndicator, FAB, IconButton, Snackbar, Text, useTheme } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MedicalRecord } from "@phr/shared";
import { useApi } from "../lib/useApi";
import { useAuth } from "../lib/authContext";
import { downloadAndShareAll } from "../lib/download";
import RecordList, { sortRecordsForTimeline, type TimelineView } from "../components/RecordList";
import SelectionBar from "../components/SelectionBar";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "FamilyTimeline">;

export default function FamilyTimelineScreen({ route, navigation }: Props) {
  const { familyId, patientId } = route.params;
  const api = useApi();
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<TimelineView>(user?.defaultTimelineView ?? "grid");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!api) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const list = await api.recordsClient.listRecords(familyId, { patientId });
        setRecords(list);
        if (patientId) {
          const family = await api.familyClient.getFamily(familyId);
          setPatientName(family.patients.find((p) => p.id === patientId)?.name ?? null);
        } else {
          setPatientName(null);
        }
      } catch {
        setError("Could not load the health record.");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [api, familyId, patientId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    navigation.setOptions({ title: patientName ? `${patientName}'s Health Record` : "Health Record" });
  }, [navigation, patientName]);

  function startSelection(record: MedicalRecord) {
    setSelectionMode(true);
    setSelectedIds(new Set([record.id]));
  }

  function toggleSelect(record: MedicalRecord) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(record.id)) next.delete(record.id);
      else next.add(record.id);
      return next;
    });
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkDownload() {
    if (!api || selectedIds.size === 0) return;
    setDownloading(true);
    setDownloadError(null);
    const selected = records.filter((r) => selectedIds.has(r.id));
    const { failed } = await downloadAndShareAll(api.recordsClient, selected);
    setDownloading(false);
    if (failed.length > 0) {
      setDownloadError(`Could not download ${failed.length} of ${selected.length} document(s).`);
    }
    cancelSelection();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {selectionMode ? (
          <SelectionBar
            count={selectedIds.size}
            downloading={downloading}
            onCancel={cancelSelection}
            onDownload={handleBulkDownload}
          />
        ) : (
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>
              {patientName ? `${patientName}'s Health Record` : "Health Record"}
            </Text>
            <IconButton
              icon={view === "grid" ? "view-list" : "view-grid"}
              onPress={() => setView(view === "grid" ? "list" : "grid")}
            />
          </View>
        )}
        {error && (
          <Text style={styles.error} variant="bodyMedium">
            {error}
          </Text>
        )}
        <RecordList
          records={records}
          view={view}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onLongPressRecord={startSelection}
          onPressRecord={(record) => {
            const ordered = sortRecordsForTimeline(records);
            navigation.navigate("RecordViewer", {
              recordIds: ordered.map((r) => r.id),
              index: ordered.findIndex((r) => r.id === record.id),
            });
          }}
        />
      </ScrollView>
      {!selectionMode && (
        <FAB
          icon="plus"
          color={theme.colors.onPrimary}
          style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: 16 + insets.bottom }]}
          onPress={() => navigation.navigate("Upload", { familyId, patientId })}
        />
      )}
      <Snackbar visible={Boolean(downloadError)} onDismiss={() => setDownloadError(null)} duration={4000}>
        {downloadError}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 96 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontWeight: "600" },
  error: { color: "#c62828", marginBottom: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  fab: { position: "absolute", right: 16, bottom: 16 },
});
