"use client";

import { useEffect, useState } from "react";
import type { AdminUser } from "@phr/shared";
import { ApiRequestError } from "@phr/shared";
import { adminClient } from "../../lib/api";
import { dateInputValue, todayDateInputValue } from "../../lib/date";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/VpnKey";
import AddIcon from "@mui/icons-material/Add";
import LockIcon from "@mui/icons-material/Lock";

export default function UsersSection() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [forceChangePassword, setForceChangePassword] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  function load() {
    adminClient()
      .listUsers()
      .then(setUsers)
      .catch(() => setError("Could not load users."));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!createName.trim() || !createEmail.trim() || createPassword.length < 8) {
      setCreateError("Name, email, and an 8+ character password are required.");
      return;
    }
    try {
      await adminClient().createUser({
        name: createName,
        email: createEmail,
        password: createPassword,
        forceChangePassword,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setForceChangePassword(true);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") {
        setCreateError("An account with this email already exists.");
      } else {
        setCreateError("Could not create this user.");
      }
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    try {
      await adminClient().updateUser(editing.id, {
        name: editName,
        email: editEmail,
        phone: editPhone || undefined,
        dateOfBirth: editDateOfBirth || undefined,
        address: editAddress || undefined,
      });
      setEditing(null);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") {
        setEditError("An account with this email already exists.");
      } else {
        setEditError("Could not update this user.");
      }
    }
  }

  async function handleEditPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!editing || !file) return;
    setPhotoUploading(true);
    try {
      const updated = await adminClient().uploadUserPhoto(editing.id, {
        blob: file,
        name: file.name,
        type: file.type,
      });
      setEditAvatarUrl(updated.avatarUrl ?? null);
    } catch {
      setEditError("Could not upload this photo. Only JPEG and PNG files are supported.");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetting) return;
    setResetError(null);
    if (resetPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    try {
      await adminClient().resetPassword(resetting.id, { newPassword: resetPassword });
      setResetting(null);
      setResetPassword("");
    } catch {
      setResetError("Could not reset this user's password.");
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await adminClient().deleteUser(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "CANNOT_REMOVE_OWNER") {
        setError(
          `${pendingDelete.name} owns a family with other members — transfer or delete that family first.`
        );
      } else if (err instanceof ApiRequestError && err.body.error === "CANNOT_DELETE_SELF") {
        setError("You can't delete your own account.");
      } else if (err instanceof ApiRequestError && err.body.error === "CANNOT_MODIFY_ADMIN") {
        setError("System admin accounts can't be deleted from here.");
      } else {
        setError("Could not delete this user.");
      }
      setPendingDelete(null);
    }
  }

  return (
    <>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Users
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Add user
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined">
        {users && users.length > 0 ? (
          <List disablePadding>
            {users.map((user) => (
              <ListItem
                key={user.id}
                divider
                secondaryAction={
                  user.isAdmin ? (
                    <IconButton size="small" disabled title="System admin account — not editable">
                      <LockIcon fontSize="small" />
                    </IconButton>
                  ) : (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        title="Reset password"
                        onClick={() => setResetting(user)}
                      >
                        <KeyIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Edit"
                        onClick={() => {
                          setEditing(user);
                          setEditName(user.name);
                          setEditEmail(user.email);
                          setEditPhone(user.phone ?? "");
                          setEditDateOfBirth(dateInputValue(user.dateOfBirth));
                          setEditAddress(user.address ?? "");
                          setEditAvatarUrl(user.avatarUrl ?? null);
                          setEditError(null);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        title="Delete"
                        onClick={() => setPendingDelete(user)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <span>{user.name}</span>
                      {user.isAdmin && <Chip label="Admin" size="small" color="primary" />}
                      {user.mustChangePassword && (
                        <Chip label="Must change password" size="small" color="warning" />
                      )}
                    </Stack>
                  }
                  secondary={
                    <>
                      {user.email}
                      {user.families.length > 0 &&
                        ` · ${user.families.map((f) => f.name).join(", ")}`}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <CardContent>
            <Typography color="text.secondary">No users yet.</Typography>
          </CardContent>
        )}
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add user</DialogTitle>
        <DialogContent>
          <Stack component="form" id="create-user-form" onSubmit={handleCreate} spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={createName} onChange={(e) => setCreateName(e.target.value)} fullWidth autoFocus />
            <TextField label="Email" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} fullWidth />
            <TextField
              label="Temporary password"
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              helperText="At least 8 characters"
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={forceChangePassword}
                  onChange={(e) => setForceChangePassword(e.target.checked)}
                />
              }
              label="Force password change on first login"
            />
            {createError && <Alert severity="error">{createError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button type="submit" form="create-user-form" variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          <Stack component="form" id="edit-user-form" onSubmit={handleSaveEdit} spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Avatar src={editAvatarUrl ?? undefined} sx={{ width: 56, height: 56 }}>
                {editName.charAt(0).toUpperCase()}
              </Avatar>
              <Button variant="outlined" component="label" size="small" disabled={photoUploading}>
                {photoUploading ? "Uploading..." : "Change photo"}
                <input
                  type="file"
                  hidden
                  accept="image/jpeg,image/png"
                  onChange={handleEditPhotoChange}
                />
              </Button>
            </Stack>
            <TextField label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth autoFocus />
            <TextField label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} fullWidth />
            <TextField
              label="Mobile number"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              fullWidth
            />
            <TextField
              label="Date of birth"
              type="date"
              value={editDateOfBirth}
              onChange={(e) => setEditDateOfBirth(e.target.value)}
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { max: todayDateInputValue() },
              }}
            />
            <TextField
              label="Address"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            {editing && editing.families.length > 0 && (
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Family groups
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {editing.families.map((f) => (
                    <Chip key={f.id} label={`${f.name} (${f.role})`} size="small" />
                  ))}
                </Stack>
              </Stack>
            )}
            {editError && <Alert severity="error">{editError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="edit-user-form" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetting !== null} onClose={() => setResetting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password for {resetting?.name}</DialogTitle>
        <DialogContent>
          <Stack component="form" id="reset-password-form" onSubmit={handleConfirmReset} spacing={2} sx={{ mt: 1 }}>
            <DialogContentText>
              Share this new password with {resetting?.name}. They&apos;ll be required to change it
              on their next login.
            </DialogContentText>
            <TextField
              label="New password"
              type="text"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              helperText="At least 8 characters"
              fullWidth
              autoFocus
            />
            {resetError && <Alert severity="error">{resetError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetting(null)}>Cancel</Button>
          <Button type="submit" form="reset-password-form" variant="contained">
            Reset password
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes their family memberships and their own patient profile/records. Records
            they uploaded for other family members are kept. This can&apos;t be undone from the app.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
