"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { FamilyDetail, MedicalRecord, RecordType } from "@phr/shared";
import { recordTypes, recordTypeLabels, uploadRecordFieldsSchema } from "@phr/shared";
import { familyClient, recordsClient } from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Collapse from "@mui/material/Collapse";
import AddIcon from "@mui/icons-material/Add";
import FilterListIcon from "@mui/icons-material/FilterList";
import { todayDateInputValue } from "../../../../lib/date";
import RecordGrid from "../../../components/RecordGrid";
import PageBreadcrumbs from "../../../components/PageBreadcrumbs";

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [records, setRecords] = useState<MedicalRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patientIdParam = searchParams.get("patientId") ?? "";
  const [patientId, setPatientId] = useState(patientIdParam);
  const [recordType, setRecordType] = useState<RecordType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPatientId, setUploadPatientId] = useState(patientId);
  const [uploadRecordType, setUploadRecordType] = useState<RecordType>("PRESCRIPTION");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCapturedAt, setUploadCapturedAt] = useState(todayDateInputValue());
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectedPatientName = family?.patients.find((p) => p.id === patientId)?.name;

  const breadcrumbItems = selectedPatientName
    ? [{ label: "Home", href: "/" }, { label: selectedPatientName }]
    : [
        { label: "Settings", href: "/settings" },
        { label: family?.name ?? "Family", href: `/families/${id}` },
        { label: "Timeline" },
      ];

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    familyClient()
      .getFamily(id)
      .catch(() => setError("Could not load family."))
      .then((f) => f && setFamily(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  function search(e?: React.FormEvent, overridePatientId?: string) {
    e?.preventDefault();
    setError(null);
    recordsClient()
      .listRecords(id, {
        patientId: (overridePatientId ?? patientId) || undefined,
        recordType: recordType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        q: q || undefined,
      })
      .then(setRecords)
      .catch(() => setError("Could not load records."));
  }

  // Keep the "Patient" filter field in sync with the URL — needed because
  // clicking a different patient in the sidebar often keeps the same family
  // id (only the patientId query param changes), so this component doesn't
  // remount and a state initializer alone would never pick up the change.
  useEffect(() => {
    setPatientId(patientIdParam);
  }, [patientIdParam]);

  useEffect(() => {
    // Pass patientIdParam directly rather than relying on the patientId state
    // above, which may not have committed yet in this same effect flush.
    if (getToken()) search(undefined, patientIdParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, patientIdParam]);

  function openUploadDialog() {
    setUploadPatientId(patientId);
    setUploadTitle("");
    setUploadCapturedAt(todayDateInputValue());
    setUploadFile(null);
    setUploadError(null);
    setUploadOpen(true);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);

    const parsed = uploadRecordFieldsSchema.safeParse({
      recordType: uploadRecordType,
      title: uploadTitle,
      capturedAt: uploadCapturedAt || undefined,
    });
    if (!parsed.success) {
      setUploadError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (!uploadPatientId || !uploadFile) {
      setUploadError("Choose a patient and a file to upload.");
      return;
    }

    try {
      await recordsClient().uploadRecord(uploadPatientId, parsed.data, {
        blob: uploadFile,
        name: uploadFile.name,
        type: uploadFile.type,
      });
      setUploadOpen(false);
      search();
    } catch {
      setUploadError("Could not upload this document. Only JPEG, PNG, and PDF files are supported.");
    }
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <PageBreadcrumbs items={breadcrumbItems} />
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2, justifyContent: "space-between" }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {selectedPatientName ? `${selectedPatientName}'s Timeline` : "Timeline"}
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton
            color={filtersOpen ? "primary" : "default"}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <FilterListIcon />
          </IconButton>
          <IconButton color="primary" onClick={openUploadDialog}>
            <AddIcon />
          </IconButton>
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Collapse in={filtersOpen}>
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Stack component="form" onSubmit={search} spacing={2}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    select
                    label="Document type"
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value as RecordType)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="">All types</MenuItem>
                    {recordTypes.map((t) => (
                      <MenuItem key={t} value={t}>
                        {recordTypeLabels[t]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 3 }}>
                  <TextField
                    label="From"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    fullWidth
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 3 }}>
                  <TextField
                    label="To"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    fullWidth
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label="Search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Keyword"
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
                Apply filters
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Collapse>

      {records && records.length > 0 ? (
        <RecordGrid records={records} onChanged={() => search()} />
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary">No records match these filters.</Typography>
          </CardContent>
        </Card>
      )}

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Upload a document</DialogTitle>
        <DialogContent>
          <Stack component="form" onSubmit={handleUpload} spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Patient"
              value={uploadPatientId}
              onChange={(e) => setUploadPatientId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Select a patient</MenuItem>
              {family?.patients.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Document type"
              value={uploadRecordType}
              onChange={(e) => setUploadRecordType(e.target.value as RecordType)}
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
