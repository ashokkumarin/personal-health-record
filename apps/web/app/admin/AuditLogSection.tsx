"use client";

import { useEffect, useState } from "react";
import type { AuditLogEntryRecord } from "@phr/shared";
import { adminClient } from "../../lib/api";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

function eventLabel(eventType: string): string {
  return eventType
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// The metadata shape varies by eventType (see apps/api/src/routes/records.ts
// and admin.ts) — pull out whatever's most useful to show at a glance rather
// than dumping the raw JSON.
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
  if (typeof meta.fields === "object" && Array.isArray(meta.fields)) {
    return `changed: ${meta.fields.join(", ")}`;
  }
  return null;
}

export default function AuditLogSection() {
  const [entries, setEntries] = useState<AuditLogEntryRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  function loadFirstPage() {
    adminClient()
      .listAuditLog()
      .then((page) => {
        setEntries(page.entries);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch(() => setError("Could not load the audit log."));
  }

  useEffect(() => {
    loadFirstPage();
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await adminClient().listAuditLog({ cursor });
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
    <>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Audit Log
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined">
        {entries.length > 0 ? (
          <List disablePadding>
            {entries.map((entry) => {
              const detail = metadataDetail(entry);
              return (
                <ListItem key={entry.id} divider>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Chip label={eventLabel(entry.eventType)} size="small" />
                        <span>{entry.user ? `${entry.user.name} (${entry.user.email})` : "System"}</span>
                        {detail && (
                          <Typography variant="body2" color="text.secondary">
                            {detail}
                          </Typography>
                        )}
                      </Stack>
                    }
                    secondary={`${new Date(entry.createdAt).toLocaleString()} · ${entry.source}${
                      entry.entityType ? ` · ${entry.entityType}${entry.entityId ? ` #${entry.entityId.slice(0, 8)}` : ""}` : ""
                    }`}
                  />
                </ListItem>
              );
            })}
          </List>
        ) : (
          <CardContent>
            <Typography color="text.secondary">No audit entries yet.</Typography>
          </CardContent>
        )}
      </Card>

      {hasMore && (
        <Stack direction="row" sx={{ justifyContent: "center", mt: 2 }}>
          <Button onClick={loadMore} loading={loadingMore}>
            Load more
          </Button>
        </Stack>
      )}
    </>
  );
}
