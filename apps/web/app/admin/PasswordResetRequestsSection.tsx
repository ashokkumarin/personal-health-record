"use client";

import { useEffect, useState } from "react";
import type { PasswordResetRequestRecord } from "@phr/shared";
import { adminClient } from "../../lib/api";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}

export default function PasswordResetRequestsSection() {
  const [requests, setRequests] = useState<PasswordResetRequestRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<PasswordResetRequestRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resolveError, setResolveError] = useState<string | null>(null);

  function load() {
    adminClient()
      .listPasswordResetRequests()
      .then(setRequests)
      .catch(() => setError("Could not load password reset requests."));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolving) return;
    setResolveError(null);
    if (newPassword.length < 8) {
      setResolveError("Password must be at least 8 characters.");
      return;
    }
    try {
      await adminClient().resolvePasswordResetRequest(resolving.id, { newPassword });
      setResolving(null);
      setNewPassword("");
      load();
    } catch {
      setResolveError("Could not resolve this request.");
    }
  }

  return (
    <>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Password Reset Requests
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined">
        {requests && requests.length > 0 ? (
          <List disablePadding>
            {requests.map((request) => (
              <ListItem
                key={request.id}
                divider
                secondaryAction={
                  <Button size="small" variant="contained" onClick={() => setResolving(request)}>
                    Resolve
                  </Button>
                }
              >
                <ListItemText
                  primary={`${request.user.name} (${request.user.email})`}
                  secondary={`Requested ${formatWhen(request.createdAt)}`}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <CardContent>
            <Typography color="text.secondary">No pending requests.</Typography>
          </CardContent>
        )}
      </Card>

      <Dialog open={resolving !== null} onClose={() => setResolving(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password for {resolving?.user.name}</DialogTitle>
        <DialogContent>
          <Stack component="form" id="resolve-reset-form" onSubmit={handleResolve} spacing={2} sx={{ mt: 1 }}>
            <DialogContentText>
              Share this new password with {resolving?.user.name}. They&apos;ll be required to
              change it on their next login.
            </DialogContentText>
            <TextField
              label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="At least 8 characters"
              fullWidth
              autoFocus
            />
            {resolveError && <Alert severity="error">{resolveError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResolving(null)}>Cancel</Button>
          <Button type="submit" form="resolve-reset-form" variant="contained">
            Resolve
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
