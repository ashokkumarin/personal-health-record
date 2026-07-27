"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileSchema, changePasswordSchema, ApiRequestError } from "@phr/shared";
import { userClient } from "../../lib/api";
import { getToken, getCurrentUser, updateStoredUser } from "../../lib/auth";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    const cached = getCurrentUser();
    if (cached) {
      setName(cached.name);
      setEmail(cached.email);
    }
    userClient()
      .getMe()
      .then((user) => {
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone ?? "");
        setAvatarUrl(user.avatarUrl ?? null);
      })
      .catch(() => setProfileError("Could not load your profile."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    const parsed = updateProfileSchema.safeParse({
      name,
      email,
      phone: phone || undefined,
    });
    if (!parsed.success) {
      setProfileError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    try {
      const user = await userClient().updateProfile(parsed.data);
      updateStoredUser(user);
      setProfileSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "EMAIL_ALREADY_REGISTERED") {
        setProfileError("An account with this email already exists.");
      } else {
        setProfileError("Could not update your profile. Please try again.");
      }
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const user = await userClient().uploadPhoto({ blob: file, name: file.name, type: file.type });
      setAvatarUrl(user.avatarUrl ?? null);
      updateStoredUser(user);
    } catch {
      setPhotoError("Could not upload this photo. Only JPEG and PNG files are supported.");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    try {
      await userClient().changePassword(parsed.data);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.error === "INVALID_CREDENTIALS") {
        setPasswordError("Your current password is incorrect.");
      } else {
        setPasswordError("Could not change your password. Please try again.");
      }
    }
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }} gutterBottom>
        Profile
      </Typography>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader title="Account details" titleTypographyProps={{ variant: "h6" }} />
        <CardContent>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Avatar src={avatarUrl ?? undefined} sx={{ width: 64, height: 64 }}>
                {name.charAt(0).toUpperCase()}
              </Avatar>
              <Button variant="outlined" component="label" disabled={photoUploading}>
                {photoUploading ? "Uploading..." : "Change photo"}
                <input
                  type="file"
                  hidden
                  accept="image/jpeg,image/png"
                  onChange={handlePhotoChange}
                />
              </Button>
            </Stack>
            {photoError && <Alert severity="error">{photoError}</Alert>}

            <Stack component="form" onSubmit={handleSaveProfile} spacing={2.5}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
              />
              {profileError && <Alert severity="error">{profileError}</Alert>}
              {profileSuccess && <Alert severity="success">Profile updated.</Alert>}
              <Button type="submit" variant="contained">
                Save
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader title="Change password" titleTypographyProps={{ variant: "h6" }} />
        <CardContent>
          <Stack component="form" onSubmit={handleChangePassword} spacing={2.5}>
            <TextField
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
            />
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
            />
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            {passwordSuccess && <Alert severity="success">Password changed.</Alert>}
            <Button type="submit" variant="contained">
              Change password
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
