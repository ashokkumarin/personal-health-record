"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { FamilyDetail, AddMemberInput, RecordType } from "@phr/shared";
import { addMemberSchema, recordTypes, recordTypeLabels, uploadRecordFieldsSchema } from "@phr/shared";
import { familyClient, recordsClient } from "../../../lib/api";
import { getToken, getCurrentUser } from "../../../lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import EditIcon from "@mui/icons-material/Edit";
import { ApiRequestError } from "@phr/shared";
import { todayDateInputValue } from "../../../lib/date";
import PageBreadcrumbs from "../../components/PageBreadcrumbs";

type Mode = AddMemberInput["mode"];

export default function FamilyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("no_account");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [existingUserEmail, setExistingUserEmail] = useState("");

  const [uploadPatientId, setUploadPatientId] = useState("");
  const [uploadRecordType, setUploadRecordType] = useState<RecordType>("PRESCRIPTION");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCapturedAt, setUploadCapturedAt] = useState(todayDateInputValue());
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const currentUser = getCurrentUser();

  function load() {
    familyClient()
      .getFamily(id)
      .then(setFamily)
      .catch(() => setError("Could not load family."));
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function handlePromote(userId: string) {
    setError(null);
    try {
      await familyClient().promoteAdmin(id, userId);
      load();
    } catch {
      setError("Could not promote this member.");
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!familyNameInput.trim()) {
      setError("Family name is required.");
      return;
    }
    try {
      await familyClient().renameFamily(id, familyNameInput);
      setIsEditingName(false);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "FAMILY_NAME_TAKEN") {
        setError("A family with this name already exists.");
      } else {
        setError("Could not rename this family.");
      }
    }
  }

  async function handleDeleteFamily() {
    setError(null);
    try {
      await familyClient().deleteFamily(id);
      router.push("/settings");
    } catch {
      setError("Could not delete this family.");
      setDeleteDialogOpen(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setError(null);
    try {
      await familyClient().removeMember(id, userId);
      load();
    } catch {
      setError("Could not remove this member.");
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const base = { mode, name, relation: relation || undefined };
    const input: AddMemberInput =
      mode === "new_account"
        ? { ...base, mode: "new_account", email, password }
        : mode === "link_existing"
          ? { ...base, mode: "link_existing", existingUserEmail }
          : { ...base, mode: "no_account" };

    const parsed = addMemberSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    try {
      await familyClient().addMember(id, parsed.data);
      setName("");
      setRelation("");
      setEmail("");
      setPassword("");
      setExistingUserEmail("");
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "ALREADY_LINKED") {
        setError("That account is already linked to a patient profile elsewhere.");
      } else if (err instanceof ApiRequestError && err.body.error === "ALREADY_MEMBER") {
        setError("That person is already a member of this family.");
      } else {
        setError("Could not add this family member.");
      }
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = uploadRecordFieldsSchema.safeParse({
      recordType: uploadRecordType,
      title: uploadTitle,
      capturedAt: uploadCapturedAt || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (!uploadPatientId || !uploadFile) {
      setError("Choose a patient and a file to upload.");
      return;
    }

    try {
      await recordsClient().uploadRecord(uploadPatientId, parsed.data, {
        blob: uploadFile,
        name: uploadFile.name,
        type: uploadFile.type,
      });
      setUploadTitle("");
      setUploadCapturedAt(todayDateInputValue());
      setUploadFile(null);
      load();
    } catch {
      setError("Could not upload this document. Only JPEG, PNG, and PDF files are supported.");
    }
  }

  async function handleToggleVisibility(patientId: string, next: boolean) {
    setError(null);
    try {
      await recordsClient().setPatientVisibility(patientId, next);
      load();
    } catch {
      setError("Could not update visibility.");
    }
  }

  if (!family) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        {error ? <Alert severity="error">{error}</Alert> : <Typography>Loading...</Typography>}
      </Container>
    );
  }

  const isOwner = currentUser?.id === family.ownerId;
  const ownMembership = family.memberships.find((m) => m.userId === currentUser?.id);
  const canManage = isOwner || ownMembership?.role === "ADMIN";

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 6 }}>
      <PageBreadcrumbs items={[{ label: "Settings", href: "/settings" }, { label: family.name }]} />
      {isEditingName ? (
        <Stack component="form" onSubmit={handleRename} direction="row" spacing={1} sx={{ mb: 1 }}>
          <TextField
            value={familyNameInput}
            onChange={(e) => setFamilyNameInput(e.target.value)}
            size="small"
            autoFocus
            fullWidth
          />
          <Button type="submit" variant="contained" size="small">
            Save
          </Button>
          <Button size="small" onClick={() => setIsEditingName(false)}>
            Cancel
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {family.name}
          </Typography>
          {canManage && (
            <IconButton
              size="small"
              onClick={() => {
                setFamilyNameInput(family.name);
                setIsEditingName(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      )}
      {canManage && (
        <Button
          color="error"
          size="small"
          onClick={() => setDeleteDialogOpen(true)}
          sx={{ mb: 2 }}
        >
          Delete family
        </Button>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete &quot;{family.name}&quot;?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes the family and its {family.memberships.length} membership(s) from your
            families list. Patient profiles and their medical records are not deleted and remain
            accessible. This can&apos;t be undone from the app.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteFamily}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader title="Members" titleTypographyProps={{ variant: "h6" }} />
        <List disablePadding>
          {family.memberships.map((m) => (
            <ListItem
              key={m.id}
              divider
              secondaryAction={
                canManage &&
                m.role !== "OWNER" && (
                  <Stack direction="row" spacing={1}>
                    {isOwner && m.role !== "ADMIN" && (
                      <Button size="small" onClick={() => handlePromote(m.userId)}>
                        Promote to admin
                      </Button>
                    )}
                    <Button size="small" color="error" onClick={() => handleRemoveMember(m.userId)}>
                      Remove
                    </Button>
                  </Stack>
                )
              }
            >
              <ListItemText
                primary={`${m.user.name} (${m.user.email})`}
                secondary={
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip label={m.role} size="small" color="primary" variant="outlined" />
                    <Chip
                      label={m.status}
                      size="small"
                      color={m.status === "ACTIVE" ? "success" : "warning"}
                      variant="outlined"
                    />
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader title="Patient profiles" titleTypographyProps={{ variant: "h6" }} />
        <List disablePadding>
          {family.patients.map((p) => (
            <ListItem key={p.id} divider>
              <ListItemText
                primary={p.name}
                secondary={p.linkedUserId ? "Linked account" : "No account — managed by family"}
              />
              {currentUser?.id === p.linkedUserId && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={p.visibleToFamily}
                      onChange={(e) => handleToggleVisibility(p.id, e.target.checked)}
                    />
                  }
                  label="Share with family"
                  labelPlacement="start"
                />
              )}
            </ListItem>
          ))}
        </List>
      </Card>

      <Button component={Link} href={`/families/${family.id}/timeline`} sx={{ mb: 3 }}>
        View timeline →
      </Button>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader title="Upload a document" titleTypographyProps={{ variant: "h6" }} />
        <CardContent>
          <Stack component="form" onSubmit={handleUpload} spacing={2.5}>
            <TextField
              select
              label="Patient"
              value={uploadPatientId}
              onChange={(e) => setUploadPatientId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Select a patient</MenuItem>
              {family.patients.map((p) => (
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
            <Button type="submit" variant="contained">
              Upload
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader title="Add a family member" titleTypographyProps={{ variant: "h6" }} />
        <CardContent>
          <Stack component="form" onSubmit={handleAddMember} spacing={2.5}>
            <TextField
              select
              label="Mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              fullWidth
            >
              <MenuItem value="no_account">No account (I&apos;ll manage their records)</MenuItem>
              <MenuItem value="new_account">Create a new account for them</MenuItem>
              <MenuItem value="link_existing">
                Link an existing account (needs their approval)
              </MenuItem>
            </TextField>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField
              label="Relation"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              fullWidth
            />
            {mode === "new_account" && (
              <>
                <Divider />
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                />
              </>
            )}
            {mode === "link_existing" && (
              <>
                <Divider />
                <TextField
                  label="Existing user's email"
                  type="email"
                  value={existingUserEmail}
                  onChange={(e) => setExistingUserEmail(e.target.value)}
                  fullWidth
                />
              </>
            )}
            <Button type="submit" variant="contained">
              Add member
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
