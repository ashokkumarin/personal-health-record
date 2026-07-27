import { createAuthClient } from "@phr/shared";

// Android emulator reaches the host machine via 10.0.2.2; iOS simulator via localhost.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export const authClient = createAuthClient(API_URL);
