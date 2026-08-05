"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordSchema, ApiRequestError } from "@phr/shared";
import { userClient } from "../../lib/api";
import { getToken, getCurrentUser, updateStoredUser } from "../../lib/auth";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);
    try {
      await userClient().changePassword(parsed.data);
      const user = getCurrentUser();
      if (user) updateStoredUser({ ...user, mustChangePassword: false });
      window.location.href = "/";
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "INVALID_CREDENTIALS") {
        setError("Your current password is incorrect.");
      } else {
        setError("Could not change your password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Card variant="outlined">
        <CardContent sx={{ p: 4 }}>
          <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Set a new password
            </Typography>
            <Typography variant="body2" color="text.secondary">
              An admin gave you a temporary password. Choose a new one to continue.
            </Typography>
            <TextField
              label="Temporary password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" loading={submitting}>
              Change password
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
