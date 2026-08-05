"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, getToken } from "../../lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Card from "@mui/material/Card";
import PeopleIcon from "@mui/icons-material/People";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HistoryIcon from "@mui/icons-material/History";
import UsersSection from "./UsersSection";
import PasswordResetRequestsSection from "./PasswordResetRequestsSection";
import AuditLogSection from "./AuditLogSection";

const SECTIONS = [
  { id: "users", label: "Users", icon: <PeopleIcon fontSize="small" /> },
  {
    id: "password-reset-requests",
    label: "Password Reset Requests",
    icon: <NotificationsIcon fontSize="small" />,
  },
  { id: "audit-log", label: "Audit Log", icon: <HistoryIcon fontSize="small" /> },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function AdminPage() {
  const router = useRouter();
  const [section, setSection] = useState<SectionId>("users");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    if (!getCurrentUser()?.isAdmin) {
      router.push("/");
      return;
    }
    setAllowed(true);
  }, [router]);

  if (!allowed) return null;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }} gutterBottom>
        Admin
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
        <Card
          variant="outlined"
          sx={{ width: { xs: "100%", sm: 260 }, flexShrink: 0, position: { sm: "sticky" }, top: { sm: 88 } }}
        >
          <List disablePadding sx={{ py: 1 }}>
            {SECTIONS.map((s) => {
              const selected = section === s.id;
              return (
                <ListItemButton
                  key={s.id}
                  selected={selected}
                  onClick={() => setSection(s.id)}
                  sx={{
                    mx: 1,
                    borderRadius: 1.5,
                    borderLeft: "3px solid",
                    borderLeftColor: selected ? "primary.main" : "transparent",
                    "&.Mui-selected": {
                      bgcolor: (theme) => `${theme.palette.primary.main}14`,
                    },
                    "&.Mui-selected:hover": {
                      bgcolor: (theme) => `${theme.palette.primary.main}20`,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: selected ? "primary.main" : "text.secondary" }}>
                    {s.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={s.label}
                    slotProps={{ primary: { sx: { fontWeight: selected ? 600 : 400 } } }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Card>

        <Stack sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          {section === "users" && <UsersSection />}
          {section === "password-reset-requests" && <PasswordResetRequestsSection />}
          {section === "audit-log" && <AuditLogSection />}
        </Stack>
      </Stack>
    </Container>
  );
}
