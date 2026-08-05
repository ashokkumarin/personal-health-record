import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, List, Text } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import type { AuditLogEntryRecord } from "@phr/shared";
import { useApi } from "../../lib/useApi";

function eventLabel(eventType: string): string {
  return eventType
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function metadataDetail(entry: AuditLogEntryRecord): string | null {
  const meta = entry.metadata as Record<string, unknown> | null;
  if (!meta) return null;
  if (entry.entityType === "record" && typeof meta.title === "string") {
    return `"${meta.title}"`;
  }
  if (entry.entityType === "user" && typeof meta.email === "string") {
    const name = typeof meta.name === "string" ? meta.name : meta.email;
    return `${name} (${meta.email})`;
  }
  if (Array.isArray(meta.fields)) {
    return `changed: ${meta.fields.join(", ")}`;
  }
  return null;
}

export default function AdminAuditLogTab() {
  const api = useApi();
  const [entries, setEntries] = useState<AuditLogEntryRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirstPage = useCallback(() => {
    if (!api) return;
    api.adminClient
      .listAuditLog()
      .then((page) => {
        setEntries(page.entries);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch(() => setError("Could not load the audit log."));
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
    }, [loadFirstPage])
  );

  async function loadMore() {
    if (!api || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await api.adminClient.listAuditLog({ cursor });
      setEntries((prev) => [...prev, ...page.entries]);
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
    } catch {
      setError("Could not load more entries.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Audit Log
      </Text>
      {error && (
        <Text variant="bodyMedium" style={styles.error}>
          {error}
        </Text>
      )}

      {entries.length === 0 && (
        <Text variant="bodyMedium" style={styles.empty}>
          No audit entries yet.
        </Text>
      )}
      {entries.map((entry) => {
        const detail = metadataDetail(entry);
        return (
          <List.Item
            key={entry.id}
            title={() => (
              <View style={styles.titleRow}>
                <Chip compact textStyle={styles.chipText}>
                  {eventLabel(entry.eventType)}
                </Chip>
                <Text variant="bodyMedium">
                  {entry.user ? `${entry.user.name}` : "System"}
                </Text>
              </View>
            )}
            description={`${detail ? `${detail} · ` : ""}${new Date(entry.createdAt).toLocaleString()} · ${entry.source}`}
          />
        );
      })}

      {hasMore && (
        <Button onPress={loadMore} loading={loadingMore} style={{ marginTop: 8 }}>
          Load more
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontWeight: "600", marginBottom: 8 },
  error: { color: "#c62828", marginBottom: 8 },
  empty: { opacity: 0.6, paddingVertical: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  chipText: { fontSize: 11, lineHeight: 14, marginVertical: 4 },
});
