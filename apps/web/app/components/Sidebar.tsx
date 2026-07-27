"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FamilyDetail } from "@phr/shared";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { familyClient } from "../../lib/api";

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

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 280 }} role="presentation">
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
    </Drawer>
  );
}
