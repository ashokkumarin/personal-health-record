"use client";

import { useState } from "react";
import Link from "next/link";
import { loginSchema, forgotPasswordSchema, ApiRequestError } from "@phr/shared";
import { authClient } from "../../lib/api";
import { setSession } from "../../lib/auth";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

function ForgotPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    onClose();
    setEmail("");
    setError(null);
    setSent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      await authClient.forgotPassword(parsed.data);
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Reset your password</DialogTitle>
      <DialogContent>
        {sent ? (
          <Alert severity="success" sx={{ mt: 1 }}>
            If that account exists, an admin has been notified and will reach out with a new
            password.
          </Alert>
        ) : (
          <Stack component="form" id="forgot-password-form" onSubmit={handleSubmit} spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Enter your account email. There&apos;s no automated email reset — an admin will see
              your request and set a temporary password for you.
            </Typography>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoFocus
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>{sent ? "Close" : "Cancel"}</Button>
        {!sent && (
          <Button type="submit" form="forgot-password-form" variant="contained" loading={submitting}>
            Notify admin
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    try {
      const { user, token } = await authClient.login(parsed.data);
      setSession(user, token);
      // A hard navigation (not router.push) so every page component remounts
      // fresh with the new session — otherwise switching accounts can leave
      // pages showing the previous user's already-fetched data, since the
      // App Router can reuse existing component instances across a soft
      // client-side navigation to the same URL.
      window.location.href = user.mustChangePassword ? "/change-password" : "/";
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "INVALID_CREDENTIALS") {
        setError("Incorrect email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Card variant="outlined">
        <CardContent sx={{ p: 4 }}>
          <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Log in
            </Typography>
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
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large">
              Log in
            </Button>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Need an account? <Link href="/register">Register</Link>
              </Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => setForgotOpen(true)}
                sx={{ minWidth: 0, p: 0 }}
              >
                Forgot password?
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </Container>
  );
}
