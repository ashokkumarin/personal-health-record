"use client";

import { useState } from "react";
import Link from "next/link";
import { loginSchema, ApiRequestError } from "@phr/shared";
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      window.location.href = "/";
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
            <Typography variant="body2" color="text.secondary">
              Need an account? <Link href="/register">Register</Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
