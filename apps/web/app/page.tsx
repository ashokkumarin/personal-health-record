"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import type { MyTimeline, RecordType } from "@phr/shared";
import { recordTypes, uploadRecordFieldsSchema } from "@phr/shared";
import { getToken } from "../lib/auth";
import { recordsClient } from "../lib/api";
import { todayDateInputValue } from "../lib/date";
import RecordGrid from "./components/RecordGrid";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);
  const [timeline, setTimeline] = useState<MyTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadRecordType, setUploadRecordType] = useState<RecordType>("PRESCRIPTION");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCapturedAt, setUploadCapturedAt] = useState(todayDateInputValue());
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function load() {
    recordsClient()
      .getMyTimeline()
      .then(setTimeline)
      .catch(() => setError("Could not load your timeline."));
  }

  useEffect(() => {
    const hasToken = Boolean(getToken());
    setLoggedIn(hasToken);
    setChecked(true);
    if (!hasToken) return;
    load();
  }, []);

  function openUploadDialog() {
    setUploadTitle("");
    setUploadCapturedAt(todayDateInputValue());
    setUploadFile(null);
    setUploadError(null);
    setUploadOpen(true);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);

    if (!timeline?.patient) return;

    const parsed = uploadRecordFieldsSchema.safeParse({
      recordType: uploadRecordType,
      title: uploadTitle,
      capturedAt: uploadCapturedAt || undefined,
    });
    if (!parsed.success) {
      setUploadError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (!uploadFile) {
      setUploadError("Choose a file to upload.");
      return;
    }

    try {
      await recordsClient().uploadRecord(timeline.patient.id, parsed.data, {
        blob: uploadFile,
        name: uploadFile.name,
        type: uploadFile.type,
      });
      setUploadOpen(false);
      load();
    } catch {
      setUploadError("Could not upload this document. Only JPEG, PNG, and PDF files are supported.");
    }
  }

  if (!checked) return null;

  if (!loggedIn) {
    return (
      <Container maxWidth="sm" sx={{ mt: 10, textAlign: "center" }}>
        <Box component="img" src="/logo.svg" alt="PHR logo" sx={{ width: 72, height: 72, mb: 2 }} />
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          Personal Health Record
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Keep your family&apos;s medical documents organized in one secure place.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ justifyContent: "center" }}>
          <Button component={Link} href="/register" variant="contained" size="large">
            Create an account
          </Button>
          <Button component={Link} href="/login" variant="outlined" size="large">
            Log in
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {timeline?.patient ? `${timeline.patient.name}'s Timeline` : "Your timeline"}
        </Typography>
        {timeline?.patient && (
          <IconButton color="primary" onClick={openUploadDialog}>
            <AddIcon />
          </IconButton>
        )}
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {timeline && timeline.patient === null && (
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary">
              You don&apos;t have a linked patient profile yet. Once a family links your account
              to a patient profile, your own records will show up here.
            </Typography>
          </CardContent>
        </Card>
      )}

      {timeline && timeline.patient !== null && (
        timeline.records.length > 0 ? (
          <RecordGrid records={timeline.records} onChanged={load} />
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary">No records yet.</Typography>
            </CardContent>
          </Card>
        )
      )}

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Upload a document</DialogTitle>
        <DialogContent>
          <Stack component="form" onSubmit={handleUpload} spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Document type"
              value={uploadRecordType}
              onChange={(e) => setUploadRecordType(e.target.value as RecordType)}
              fullWidth
            >
              {recordTypes.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              fullWidth
            />
            <TextField
              label="Document date"
              type="date"
              value={uploadCapturedAt}
              onChange={(e) => setUploadCapturedAt(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayDateInputValue() } }}
            />
            <Button variant="outlined" component="label">
              {uploadFile ? uploadFile.name : "Choose file (JPEG, PNG, or PDF)"}
              <input
                type="file"
                hidden
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            {uploadError && <Alert severity="error">{uploadError}</Alert>}
            <DialogActions sx={{ px: 0 }}>
              <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Upload
              </Button>
            </DialogActions>
          </Stack>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
