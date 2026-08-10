"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FamilyDetail } from "@phr/shared";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { familyClient } from "../../lib/api";
import { clearSession } from "../../lib/auth";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const [families, setFamilies] = useState<FamilyDetail[] | null>(null);

  useEffect(() => {
    if (!open) return;
    familyClient()
      .listFamilies()
      .then((list) => Promise.all(list.map((f) => familyClient().getFamily(f.id))))
      .then(setFamilies)
      .catch(() => setFamilies([]));
  }, [open]);

  function go(path: string) {
    onClose();
    router.push(path);
  }

  function handleLogout() {
    onClose();
    clearSession();
    // Hard navigation, same reasoning as Nav's login/logout — forces every
    // page component to remount fresh rather than reusing stale state.
    window.location.href = "/login";
  }

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box
        sx={{ width: 280, height: "100%", display: "flex", flexDirection: "column" }}
        role="presentation"
      >
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {families === null && (
            <Typography sx={{ p: 2 }} color="text.secondary">
              Loading...
            </Typography>
          )}
          {families?.length === 0 && (
            <Typography sx={{ p: 2 }} color="text.secondary">
              You don&apos;t belong to any families yet.
            </Typography>
          )}
          {families && families.length > 0 && (
            <SimpleTreeView
              defaultExpandedItems={families.map((f) => f.id)}
              sx={{ px: 1, py: 1 }}
            >
              {families.map((family) => (
                <TreeItem
                  key={family.id}
                  itemId={family.id}
                  label={
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", py: 0.5 }}
                      onClick={() => go(`/families/${family.id}`)}
                    >
                      <GroupsIcon fontSize="small" color="primary" />
                      <Typography sx={{ fontWeight: 600 }}>{family.name}</Typography>
                    </Stack>
                  }
                >
                  {family.patients.length > 0 ? (
                    family.patients.map((patient) => (
                      <TreeItem
                        key={patient.id}
                        itemId={patient.id}
                        label={
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", py: 0.5 }}
                            onClick={() =>
                              go(`/families/${family.id}/timeline?patientId=${patient.id}`)
                            }
                          >
                            <PersonIcon fontSize="small" />
                            <Typography>{patient.name}</Typography>
                          </Stack>
                        }
                      />
                    ))
                  ) : (
                    <TreeItem
                      itemId={`${family.id}-empty`}
                      label={
                        <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
                          No patient profiles yet.
                        </Typography>
                      }
                      disabled
                    />
                  )}
                </TreeItem>
              ))}
            </SimpleTreeView>
          )}
        </Box>
        <Divider />
        <List sx={{ py: 0 }}>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText slotProps={{ primary: { color: "error" } }}>Log out</ListItemText>
          </ListItemButton>
        </List>
      </Box>
    </Drawer>
  );
}
