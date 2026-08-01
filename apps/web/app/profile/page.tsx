"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileSchema, changePasswordSchema, ApiRequestError } from "@phr/shared";
import { userClient } from "../../lib/api";
import { getToken, getCurrentUser, updateStoredUser } from "../../lib/auth";
import { todayDateInputValue, dateInputValue } from "../../lib/date";
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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";

const SECTIONS = [
  { id: "personal-info", label: "Personal Info", icon: <PersonIcon fontSize="small" /> },
  { id: "security", label: "Security", icon: <LockIcon fontSize="small" /> },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function ProfilePage() {
  const router = useRouter();
  const theme = useTheme();
  const isWideScreen = useMediaQuery(theme.breakpoints.up("sm"));
  const [section, setSection] = useState<SectionId>("personal-info");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
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
        setDateOfBirth(dateInputValue(user.dateOfBirth));
        setAddress(user.address ?? "");
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
      dateOfBirth: dateOfBirth || undefined,
      address: address || undefined,
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
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }} gutterBottom>
        Profile
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
        <Card
          variant="outlined"
          sx={{
            width: { xs: "100%", sm: 220 },
            flexShrink: 0,
            position: { sm: "sticky" },
            top: { sm: 88 },
          }}
        >
          <Tabs
            orientation={isWideScreen ? "vertical" : "horizontal"}
            variant={isWideScreen ? "standard" : "scrollable"}
            scrollButtons={isWideScreen ? false : "auto"}
            value={SECTIONS.findIndex((s) => s.id === section)}
            onChange={(_e, next) => setSection(SECTIONS[next].id)}
            sx={{
              "& .MuiTab-root": {
                alignItems: { sm: "flex-start" },
                justifyContent: { sm: "flex-start" },
                textAlign: "left",
                minHeight: 48,
              },
            }}
          >
            {SECTIONS.map((s) => (
              <Tab key={s.id} icon={s.icon} iconPosition="start" label={s.label} />
            ))}
          </Tabs>
        </Card>

        <Stack sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          {section === "personal-info" && (
            <Card variant="outlined">
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
                    <TextField
                      label="Date of birth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      fullWidth
                      slotProps={{
                        inputLabel: { shrink: true },
                        htmlInput: { max: todayDateInputValue() },
                      }}
                    />
                    <TextField
                      label="Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
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
          )}

          {section === "security" && (
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
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
