"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Family } from "@phr/shared";
import { ApiRequestError } from "@phr/shared";
import { familyClient } from "../../lib/api";
import { getToken } from "../../lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import GroupsIcon from "@mui/icons-material/Groups";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

export default function FamiliesPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Family | null>(null);

  function load() {
    familyClient()
      .listFamilies()
      .then(setFamilies)
      .catch(() => setError("Could not load families."));
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Family name is required.");
      return;
    }
    try {
      await familyClient().createFamily({ name });
      setName("");
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "FAMILY_NAME_TAKEN") {
        setError("A family with this name already exists.");
      } else {
        setError("Could not create family. Please try again.");
      }
    }
  }

  async function handleSaveRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    try {
      await familyClient().renameFamily(editingId, editValue);
      setEditingId(null);
      load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "FAMILY_NAME_TAKEN") {
        setError("A family with this name already exists.");
      } else {
        setError("Could not rename this family.");
      }
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await familyClient().deleteFamily(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch {
      setError("Could not delete this family.");
      setPendingDelete(null);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }} gutterBottom>
        Your families
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 3 }}>
        {families && families.length > 0 ? (
          <List disablePadding>
            {families.map((family) => {
              const canManage = family.myRole === "OWNER" || family.myRole === "ADMIN";

              if (editingId === family.id) {
                return (
                  <ListItem key={family.id} divider>
                    <Stack
                      component="form"
                      onSubmit={handleSaveRename}
                      direction="row"
                      spacing={1}
                      sx={{ width: "100%" }}
                    >
                      <TextField
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        size="small"
                        autoFocus
                        fullWidth
                      />
                      <Button type="submit" size="small" variant="contained">
                        Save
                      </Button>
                      <Button size="small" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </Stack>
                  </ListItem>
                );
              }

              return (
                <ListItem
                  key={family.id}
                  divider
                  disablePadding
                  secondaryAction={
                    canManage && (
                      <Stack direction="row" spacing={0.5} sx={{ pr: 1 }}>
                        <IconButton
                          size="small"
                          edge="end"
                          onClick={() => {
                            setEditingId(family.id);
                            setEditValue(family.name);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          edge="end"
                          color="error"
                          onClick={() => setPendingDelete(family)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )
                  }
                >
                  <ListItemButton component={Link} href={`/families/${family.id}`}>
                    <GroupsIcon sx={{ mr: 2, color: "primary.main" }} />
                    <ListItemText primary={family.name} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        ) : (
          <CardContent>
            <Typography color="text.secondary">
              You don&apos;t belong to any families yet.
            </Typography>
          </CardContent>
        )}
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Create a family
          </Typography>
          <Stack component="form" onSubmit={handleCreate} direction="row" spacing={2}>
            <TextField
              label="Family name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
            />
            <Button type="submit" variant="contained">
              Create
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete &quot;{pendingDelete?.name}&quot;?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes the family from your families list. Patient profiles and their medical
            records are not deleted and remain accessible. This can&apos;t be undone from the app.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
