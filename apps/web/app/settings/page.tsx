"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "@phr/shared";
import { getToken } from "../../lib/auth";
import { familyClient } from "../../lib/api";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";

export default function SettingsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    }
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Family name is required.");
      return;
    }
    try {
      const family = await familyClient().createFamily({ name });
      router.push(`/families/${family.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "FAMILY_NAME_TAKEN") {
        setError("A family with this name already exists.");
      } else {
        setError("Could not create family. Please try again.");
      }
    }
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }} gutterBottom>
        Settings
      </Typography>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader title="Add a family" titleTypographyProps={{ variant: "h6" }} />
        <CardContent>
          <Stack component="form" onSubmit={handleCreate} spacing={2}>
            <TextField
              label="Family name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
              Create
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography color="text.secondary">More settings are coming soon.</Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
