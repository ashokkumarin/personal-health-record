import { Fragment } from "react";
import { Image, TouchableOpacity, View, StyleSheet, useWindowDimensions } from "react-native";
import { Divider, Icon, Text, useTheme } from "react-native-paper";
import { recordTypeLabels, type MedicalRecord } from "@phr/shared";

export type TimelineView = "grid" | "list";
export type SortOption = "date-desc" | "date-asc";

export const SORT_OPTION_LABELS: Record<SortOption, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
};

interface Props {
  records: MedicalRecord[];
  view: TimelineView;
  sortOption?: SortOption;
  onPressRecord: (record: MedicalRecord) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (record: MedicalRecord) => void;
  onLongPressRecord?: (record: MedicalRecord) => void;
}

type ItemProps = Omit<Props, "view" | "records" | "sortOption"> & { records: MedicalRecord[] };

function fallbackIcon(fileType: string) {
  return fileType === "application/pdf" ? "file-pdf-box" : "file-image";
}

export function sortRecordsForTimeline(
  records: MedicalRecord[],
  sortOption: SortOption = "date-desc"
): MedicalRecord[] {
  const sorted = [...records];
  return sortOption === "date-asc"
    ? sorted.sort((a, b) => (a.capturedAt ?? a.uploadedAt).localeCompare(b.capturedAt ?? b.uploadedAt))
    : sorted.sort((a, b) => (b.capturedAt ?? b.uploadedAt).localeCompare(a.capturedAt ?? a.uploadedAt));
}

function groupByDate(sorted: MedicalRecord[]) {
  const groups: { date: string; records: MedicalRecord[] }[] = [];
  for (const record of sorted) {
    const date = (record.capturedAt ?? record.uploadedAt).slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.records.push(record);
    } else {
      groups.push({ date, records: [record] });
    }
  }
  return groups;
}

function monthYearLabel(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function groupByMonth(sorted: MedicalRecord[]) {
  const groups: { label: string; records: MedicalRecord[] }[] = [];
  for (const record of sorted) {
    const label = monthYearLabel(record.capturedAt ?? record.uploadedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.records.push(record);
    } else {
      groups.push({ label, records: [record] });
    }
  }
  return groups;
}

function formatGroupDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function RecordList({
  records,
  view,
  sortOption = "date-desc",
  onPressRecord,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onLongPressRecord,
}: Props) {
  if (records.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="bodyMedium" style={{ opacity: 0.6 }}>
          No records yet.
        </Text>
      </View>
    );
  }

  const sorted = sortRecordsForTimeline(records, sortOption);
  const itemProps: ItemProps = {
    records: sorted,
    onPressRecord,
    selectionMode,
    selectedIds,
    onToggleSelect,
    onLongPressRecord,
  };

  return view === "grid" ? <GridView {...itemProps} /> : <VerticalTimeline {...itemProps} />;
}

function useRecordPressHandlers(props: ItemProps) {
  function handlePress(record: MedicalRecord) {
    if (props.selectionMode) {
      props.onToggleSelect?.(record);
    } else {
      props.onPressRecord(record);
    }
  }

  function handleLongPress(record: MedicalRecord) {
    props.onLongPressRecord?.(record);
  }

  return { handlePress, handleLongPress };
}

function SelectionBadge({ selected }: { selected: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.selectionBadge,
        selected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
      ]}
    >
      {selected && <Icon source="check" size={14} color={theme.colors.onPrimary} />}
    </View>
  );
}

function GridView(props: ItemProps) {
  const { records, selectionMode, selectedIds } = props;
  const { handlePress, handleLongPress } = useRecordPressHandlers(props);
  const { width } = useWindowDimensions();
  const columns = 3;
  const gap = 8;
  const tileSize = (width - 32 - gap * (columns - 1)) / columns;
  const groups = groupByMonth(records);

  return (
    <View>
      {groups.map((group) => (
        <View key={group.label} style={styles.monthSection}>
          <View style={styles.monthHeader}>
            <Text variant="titleSmall" style={styles.monthLabel}>
              {group.label}
            </Text>
            <Divider style={styles.monthDivider} />
          </View>
          <View style={styles.grid}>
            {group.records.map((record) => {
              const selected = selectedIds?.has(record.id) ?? false;
              return (
                <TouchableOpacity
                  key={record.id}
                  style={[styles.tile, { width: tileSize, height: tileSize }]}
                  onPress={() => handlePress(record)}
                  onLongPress={() => handleLongPress(record)}
                >
                  {record.thumbnailUrl ? (
                    <Image
                      source={{ uri: record.thumbnailUrl }}
                      style={styles.tileImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.tilePlaceholder}>
                      <Icon source={fallbackIcon(record.fileType)} size={28} />
                    </View>
                  )}
                  {selectionMode && (
                    <View style={styles.tileBadgeWrap}>
                      <SelectionBadge selected={selected} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function VerticalTimeline(props: ItemProps) {
  const { records, selectionMode, selectedIds } = props;
  const { handlePress, handleLongPress } = useRecordPressHandlers(props);
  const groups = groupByDate(records);

  return (
    <View>
      {groups.map((group) => (
        <Fragment key={group.date}>
          <View style={styles.row}>
            <Rail dotSize={12} dotColor="#00695c" />
            <Text variant="titleSmall" style={styles.dateLabel}>
              {formatGroupDate(group.date)}
            </Text>
          </View>
          {group.records.map((record) => {
            const selected = selectedIds?.has(record.id) ?? false;
            return (
              <TouchableOpacity
                key={record.id}
                style={styles.row}
                onPress={() => handlePress(record)}
                onLongPress={() => handleLongPress(record)}
              >
                <Rail dotSize={8} dotColor="#9e9e9e" />
                <View style={styles.card}>
                  {selectionMode && <SelectionBadge selected={selected} />}
                  {record.thumbnailUrl ? (
                    <Image source={{ uri: record.thumbnailUrl }} style={styles.cardThumb} />
                  ) : (
                    <View style={styles.cardThumbPlaceholder}>
                      <Icon source={fallbackIcon(record.fileType)} size={20} />
                    </View>
                  )}
                  <View style={styles.cardText}>
                    <Text variant="bodyLarge" numberOfLines={1}>
                      {record.title}
                    </Text>
                    <Text variant="bodySmall" style={{ opacity: 0.6 }}>
                      {recordTypeLabels[record.recordType]}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </Fragment>
      ))}
    </View>
  );
}

function Rail({ dotSize, dotColor }: { dotSize: number; dotColor: string }) {
  return (
    <View style={styles.rail}>
      <View style={styles.railLine} />
      <View style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: dotColor }]} />
      <View style={styles.railLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 24, alignItems: "center" },
  monthSection: { marginBottom: 20 },
  monthHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  monthLabel: { fontWeight: "700" },
  monthDivider: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { borderRadius: 8, overflow: "hidden", backgroundColor: "#eee" },
  tileImage: { width: "100%", height: "100%" },
  tilePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  tileBadgeWrap: { position: "absolute", top: 6, right: 6 },
  selectionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row" },
  rail: { width: 28, alignItems: "center" },
  railLine: { width: 2, flex: 1, backgroundColor: "#ddd" },
  dot: {},
  dateLabel: { paddingVertical: 10, fontWeight: "700" },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingRight: 16,
  },
  cardThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#eee" },
  cardThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
});
