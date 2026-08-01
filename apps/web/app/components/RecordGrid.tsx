"use client";

import { useEffect, useMemo, useState } from "react";
import type { MedicalRecord, RecordType } from "@phr/shared";
import { recordTypes, recordTypeLabels, updateRecordFieldsSchema } from "@phr/shared";
import { recordsClient } from "../../lib/api";
import { todayDateInputValue } from "../../lib/date";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
import Checkbox from "@mui/material/Checkbox";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SortIcon from "@mui/icons-material/Sort";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ImageIcon from "@mui/icons-material/Image";

interface RecordGridProps {
  records: MedicalRecord[];
  view?: "grid" | "list";
  onChanged: () => void;
}

type SortOption = "date-desc" | "date-asc";

const SORT_OPTION_LABELS: Record<SortOption, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
};

function sortRecords(records: MedicalRecord[], sortOption: SortOption): MedicalRecord[] {
  const sorted = [...records];
  return sortOption === "date-asc"
    ? sorted.sort((a, b) => (a.capturedAt ?? a.uploadedAt).localeCompare(b.capturedAt ?? b.uploadedAt))
    : sorted.sort((a, b) => (b.capturedAt ?? b.uploadedAt).localeCompare(a.capturedAt ?? a.uploadedAt));
}

function monthYearLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fileExtension(fileType: string): string {
  if (fileType === "application/pdf") return "pdf";
  if (fileType === "image/png") return "png";
  return "jpg";
}

function downloadFileName(record: MedicalRecord): string {
  return `${record.title}.${fileExtension(record.fileType)}`;
}

function PreviewBody({ record }: { record: MedicalRecord }) {
  if (!record.downloadUrl) return null;
  return record.fileType === "application/pdf" ? (
    <iframe
      src={record.downloadUrl}
      title={record.title}
      style={{ width: "100%", height: "70vh", border: "none" }}
    />
  ) : (
    <Box
      component="img"
      src={record.downloadUrl}
      alt={record.title}
      sx={{ maxWidth: "100%", display: "block", mx: "auto" }}
    />
  );
}

export default function RecordGrid({ records, view = "grid", onChanged }: RecordGridProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuRecordId, setMenuRecordId] = useState<string | null>(null);

  const [previewRecord, setPreviewRecord] = useState<MedicalRecord | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [editRecord, setEditRecord] = useState<MedicalRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRecordType, setEditRecordType] = useState<RecordType>("NOTE");
  const [editCapturedAt, setEditCapturedAt] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<MedicalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);

  const sortedRecords = useMemo(() => sortRecords(records, sortOption), [records, sortOption]);

  const menuRecord = records.find((r) => r.id === menuRecordId) ?? null;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function downloadBlob(url: string, filename: string) {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleBulkDownload() {
    const selected = records.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) return;
    setError(null);
    setBulkDownloading(true);
    setBulkProgress(0);
    let failed = 0;
    for (let i = 0; i < selected.length; i++) {
      try {
        const full = await recordsClient().getRecord(selected[i].id);
        if (full.downloadUrl) await downloadBlob(full.downloadUrl, downloadFileName(full));
      } catch {
        failed++;
      }
      setBulkProgress(i + 1);
    }
    setBulkDownloading(false);
    if (failed > 0) setError(`Could not download ${failed} of ${selected.length} document(s).`);
    cancelSelection();
  }

  const groups = useMemo(() => {
    const byMonth = new Map<string, MedicalRecord[]>();
    for (const record of sortedRecords) {
      const key = monthYearLabel(record.capturedAt ?? record.uploadedAt);
      const bucket = byMonth.get(key);
      if (bucket) {
        bucket.push(record);
      } else {
        byMonth.set(key, [record]);
      }
    }
    return Array.from(byMonth.entries());
  }, [sortedRecords]);

  async function openPreview(record: MedicalRecord) {
    setError(null);
    setPreviewLoading(true);
    try {
      const full = await recordsClient().getRecord(record.id);
      setPreviewRecord(full);
    } catch {
      setError("Could not load this document.");
    } finally {
      setPreviewLoading(false);
    }
  }

  // List view shows the preview inline rather than in a dialog, so default to
  // the first document instead of leaving the pane empty.
  useEffect(() => {
    if (view !== "list") return;
    if (previewRecord && sortedRecords.some((r) => r.id === previewRecord.id)) return;
    if (sortedRecords.length > 0) openPreview(sortedRecords[0]);
    else setPreviewRecord(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, sortedRecords]);

  function openEdit(record: MedicalRecord) {
    setMenuAnchor(null);
    setEditRecord(record);
    setEditTitle(record.title);
    setEditRecordType(record.recordType);
    setEditCapturedAt((record.capturedAt ?? record.uploadedAt).slice(0, 10));
    setEditFile(null);
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRecord) return;
    setEditError(null);

    const parsed = updateRecordFieldsSchema.safeParse({
      title: editTitle,
      recordType: editRecordType,
      capturedAt: editCapturedAt || undefined,
    });
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    try {
      await recordsClient().updateRecord(editRecord.id, parsed.data);
      if (editFile) {
        await recordsClient().replaceRecordFile(editRecord.id, {
          blob: editFile,
          name: editFile.name,
          type: editFile.type,
        });
      }
      setEditRecord(null);
      onChanged();
    } catch {
      setEditError("Could not save these changes.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    try {
      await recordsClient().deleteRecord(deleteTarget.id);
      setDeleteTarget(null);
      onChanged();
    } catch {
      setError("Could not delete this record.");
      setDeleteTarget(null);
    }
  }

  if (records.length === 0) {
    return null;
  }

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" sx={{ justifyContent: "flex-end", alignItems: "center", gap: 1, mb: 1.5 }}>
        {selectionMode ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {selectedIds.size} selected
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              disabled={selectedIds.size === 0 || bulkDownloading}
              onClick={handleBulkDownload}
            >
              {bulkDownloading ? `Downloading ${bulkProgress}/${selectedIds.size}…` : "Download"}
            </Button>
            <Button size="small" onClick={cancelSelection}>
              Cancel
            </Button>
          </Stack>
        ) : (
          <>
            <Button
              size="small"
              startIcon={<SortIcon />}
              onClick={(e) => setSortMenuAnchor(e.currentTarget)}
            >
              {SORT_OPTION_LABELS[sortOption]}
            </Button>
            <Menu anchorEl={sortMenuAnchor} open={Boolean(sortMenuAnchor)} onClose={() => setSortMenuAnchor(null)}>
              {(Object.keys(SORT_OPTION_LABELS) as SortOption[]).map((option) => (
                <MenuItem
                  key={option}
                  selected={option === sortOption}
                  onClick={() => {
                    setSortOption(option);
                    setSortMenuAnchor(null);
                  }}
                >
                  {SORT_OPTION_LABELS[option]}
                </MenuItem>
              ))}
            </Menu>
            <Button size="small" onClick={() => setSelectionMode(true)}>
              Select
            </Button>
          </>
        )}
      </Stack>

      {view === "list" ? (
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
          <Card
            variant="outlined"
            sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0, maxHeight: "75vh", overflowY: "auto" }}
          >
            {groups.map(([label, groupRecords]) => (
              <Box key={label}>
                <Typography
                  variant="caption"
                  sx={{ display: "block", px: 2, pt: 1.5, pb: 0.5, fontWeight: 600, color: "text.secondary" }}
                >
                  {label}
                </Typography>
                <List disablePadding>
                  {groupRecords.map((record) => (
                    <ListItemButton
                      key={record.id}
                      selected={previewRecord?.id === record.id}
                      onClick={() => (selectionMode ? toggleSelect(record.id) : openPreview(record))}
                    >
                      {selectionMode && (
                        <Checkbox
                          edge="start"
                          checked={selectedIds.has(record.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(record.id)}
                          sx={{ mr: 1 }}
                        />
                      )}
                      <ListItemText
                        primary={record.title}
                        secondary={(record.capturedAt ?? record.uploadedAt).slice(0, 10)}
                      />
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuAnchor(e.currentTarget);
                          setMenuRecordId(record.id);
                        }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            ))}
          </Card>

          <Card variant="outlined" sx={{ flex: 1, width: "100%", minWidth: 0, minHeight: "50vh" }}>
            {previewLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
                <CircularProgress />
              </Box>
            ) : previewRecord ? (
              <>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", justifyContent: "space-between", p: 2 }}
                >
                  <Typography variant="h6" sx={{ wordBreak: "break-word" }}>
                    {previewRecord.title}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    component="a"
                    href={previewRecord.downloadUrl}
                    download={downloadFileName(previewRecord)}
                    target="_blank"
                    rel="noopener"
                  >
                    Download
                  </Button>
                </Stack>
                <Divider />
                <Box sx={{ p: 2 }}>
                  <PreviewBody record={previewRecord} />
                </Box>
              </>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
                <Typography color="text.secondary">Select a document to preview.</Typography>
              </Box>
            )}
          </Card>
        </Stack>
      ) : (
        groups.map(([label, groupRecords]) => (
          <Box key={label} sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {label}
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Stack>
            <ImageList
              cols={4}
              gap={8}
              sx={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))!important" }}
            >
              {groupRecords.map((record) => (
                <ImageListItem key={record.id} sx={{ cursor: "pointer", position: "relative" }}>
                  {selectionMode && (
                    <Checkbox
                      checked={selectedIds.has(record.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(record.id);
                      }}
                      sx={{
                        position: "absolute",
                        top: 4,
                        left: 4,
                        zIndex: 1,
                        bgcolor: "rgba(255,255,255,0.8)",
                        borderRadius: "50%",
                        p: 0.5,
                        "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
                      }}
                    />
                  )}
                  {record.thumbnailUrl ? (
                    <img
                      src={record.thumbnailUrl}
                      alt={record.title}
                      loading="lazy"
                      onClick={() => (selectionMode ? toggleSelect(record.id) : openPreview(record))}
                      style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                    />
                  ) : (
                    <Box
                      onClick={() => (selectionMode ? toggleSelect(record.id) : openPreview(record))}
                      sx={{
                        aspectRatio: "1 / 1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "action.hover",
                      }}
                    >
                      {record.fileType === "application/pdf" ? (
                        <PictureAsPdfIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                      ) : (
                        <ImageIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                      )}
                    </Box>
                  )}
                  <ImageListItemBar
                    title={record.title}
                    subtitle={(record.capturedAt ?? record.uploadedAt).slice(0, 10)}
                    actionIcon={
                      selectionMode ? undefined : (
                        <IconButton
                          sx={{ color: "white" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuAnchor(e.currentTarget);
                            setMenuRecordId(record.id);
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      )
                    }
                  />
                </ImageListItem>
              ))}
            </ImageList>
          </Box>
        ))
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => menuRecord && openEdit(menuRecord)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteTarget(menuRecord);
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {view === "grid" && (
        <Dialog
          open={Boolean(previewRecord) || previewLoading}
          onClose={() => setPreviewRecord(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{previewRecord?.title ?? "Loading..."}</DialogTitle>
          <DialogContent>{previewRecord && <PreviewBody record={previewRecord} />}</DialogContent>
          <DialogActions>
            {previewRecord?.downloadUrl && (
              <Button
                startIcon={<DownloadIcon />}
                component="a"
                href={previewRecord.downloadUrl}
                download={downloadFileName(previewRecord)}
                target="_blank"
                rel="noopener"
              >
                Download
              </Button>
            )}
            <Button onClick={() => setPreviewRecord(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      <Dialog open={Boolean(editRecord)} onClose={() => setEditRecord(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit document</DialogTitle>
        <DialogContent>
          <Stack component="form" onSubmit={handleSaveEdit} spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Document type"
              value={editRecordType}
              onChange={(e) => setEditRecordType(e.target.value as RecordType)}
              fullWidth
            >
              {recordTypes.map((t) => (
                <MenuItem key={t} value={t}>
                  {recordTypeLabels[t]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              fullWidth
            />
            <TextField
              label="Document date"
              type="date"
              value={editCapturedAt}
              onChange={(e) => setEditCapturedAt(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayDateInputValue() } }}
            />
            <Button variant="outlined" component="label">
              {editFile ? editFile.name : "Replace file (optional)"}
              <input
                type="file"
                hidden
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            {editError && <Alert severity="error">{editError}</Alert>}
            <DialogActions sx={{ px: 0 }}>
              <Button onClick={() => setEditRecord(null)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Save
              </Button>
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete &quot;{deleteTarget?.title}&quot;?</DialogTitle>
        <DialogContent>
          <DialogContentText>This can&apos;t be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
