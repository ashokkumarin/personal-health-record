"use client";

import { useState } from "react";
import Link from "next/link";
import { registerSchema, ApiRequestError } from "@phr/shared";
import { authClient } from "../../lib/api";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    try {
      await authClient.register(parsed.data);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") {
        setError("An account with this email already exists.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Card variant="outlined">
        <CardContent sx={{ p: 4 }}>
          {success ? (
            <Stack spacing={2}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Account created
              </Typography>
              <Typography color="text.secondary">
                You can now <Link href="/login">log in</Link>.
              </Typography>
            </Stack>
          ) : (
            <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Create an account
              </Typography>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
              />
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
                Register
              </Button>
              <Typography variant="body2" color="text.secondary">
                Already have an account? <Link href="/login">Log in</Link>
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
