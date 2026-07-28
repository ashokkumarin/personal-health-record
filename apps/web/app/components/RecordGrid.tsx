"use client";

import { useMemo, useState } from "react";
import type { MedicalRecord, RecordType } from "@phr/shared";
import { recordTypes, recordTypeLabels, updateRecordFieldsSchema } from "@phr/shared";
import { recordsClient } from "../../lib/api";
import { todayDateInputValue } from "../../lib/date";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
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
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ImageIcon from "@mui/icons-material/Image";

interface RecordGridProps {
  records: MedicalRecord[];
  onChanged: () => void;
}

function monthYearLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function RecordGrid({ records, onChanged }: RecordGridProps) {
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

  const menuRecord = records.find((r) => r.id === menuRecordId) ?? null;

  const groups = useMemo(() => {
    const byMonth = new Map<string, MedicalRecord[]>();
    for (const record of records) {
      const key = monthYearLabel(record.capturedAt ?? record.uploadedAt);
      const bucket = byMonth.get(key);
      if (bucket) {
        bucket.push(record);
      } else {
        byMonth.set(key, [record]);
      }
    }
    return Array.from(byMonth.entries());
  }, [records]);

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

      {groups.map(([label, groupRecords]) => (
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
              <ImageListItem key={record.id} sx={{ cursor: "pointer" }}>
                {record.thumbnailUrl ? (
                  <img
                    src={record.thumbnailUrl}
                    alt={record.title}
                    loading="lazy"
                    onClick={() => openPreview(record)}
                    style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                  />
                ) : (
                  <Box
                    onClick={() => openPreview(record)}
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
                  }
                />
              </ImageListItem>
            ))}
          </ImageList>
        </Box>
      ))}

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

      <Dialog
        open={Boolean(previewRecord) || previewLoading}
        onClose={() => setPreviewRecord(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{previewRecord?.title ?? "Loading..."}</DialogTitle>
        <DialogContent>
          {previewRecord?.downloadUrl &&
            (previewRecord.fileType === "application/pdf" ? (
              <iframe
                src={previewRecord.downloadUrl}
                title={previewRecord.title}
                style={{ width: "100%", height: "70vh", border: "none" }}
              />
            ) : (
              <Box
                component="img"
                src={previewRecord.downloadUrl}
                alt={previewRecord.title}
                sx={{ maxWidth: "100%", display: "block", mx: "auto" }}
              />
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewRecord(null)}>Close</Button>
        </DialogActions>
      </Dialog>

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
