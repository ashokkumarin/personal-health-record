"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalRequest } from "@phr/shared";
import { familyClient, notifyApprovalsChanged } from "../../lib/api";
import { getToken } from "../../lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";

export default function ApprovalsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    familyClient()
      .listApprovals()
      .then(setRequests)
      .catch(() => setError("Could not load approval requests."));
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function respond(id: string, action: "approve" | "reject") {
    setError(null);
    try {
      if (action === "approve") {
        await familyClient().approve(id);
      } else {
        await familyClient().reject(id);
      }
      load();
      notifyApprovalsChanged();
    } catch {
      setError("Could not record your response.");
    }
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }} gutterBottom>
        Pending approvals
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {requests?.length === 0 && (
        <Typography color="text.secondary">No pending approval requests.</Typography>
      )}
      <Stack spacing={2}>
        {requests?.map((r) => (
          <Card key={r.id} variant="outlined">
            <CardContent>
              <Typography>
                A family wants to link the patient profile &quot;{r.patient.name}&quot; to your
                account.
              </Typography>
            </CardContent>
            <CardActions>
              <Button variant="contained" size="small" onClick={() => respond(r.id, "approve")}>
                Approve
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => respond(r.id, "reject")}
              >
                Reject
              </Button>
            </CardActions>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
