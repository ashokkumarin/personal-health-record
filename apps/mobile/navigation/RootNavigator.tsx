import { View, StyleSheet } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useAuth } from "../lib/authContext";
import { useServerConfig } from "../lib/serverConfigContext";
import AuthStack from "./AuthStack";
import AppDrawer from "./AppDrawer";
import ServerSetupScreen from "../screens/ServerSetupScreen";
import ServerUnreachableScreen from "../screens/ServerUnreachableScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";

export default function RootNavigator() {
  const serverConfig = useServerConfig();
  const { token, user, loading: authLoading } = useAuth();

  if (serverConfig.loading || authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // Server not configured (nor standalone chosen) yet — first run.
  if (serverConfig.mode === null) {
    return <ServerSetupScreen />;
  }

  // Not logged in yet and the configured server can't be reached — showing
  // Login here would be misleading (it'd just fail on submit with a generic
  // error indistinguishable from a wrong password). Already-logged-in
  // sessions skip this check entirely and fall through to AppDrawer, which
  // works offline against locally cached data.
  if (!token && serverConfig.mode === "server" && serverConfig.serverReachable !== true) {
    if (serverConfig.serverReachable === null) {
      return (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      );
    }
    return <ServerUnreachableScreen />;
  }

  // Standalone mode has no login step; authContext synthesizes a token as
  // soon as serverConfig.mode flips to "standalone" (see authContext.tsx),
  // so this falls straight through to AppDrawer.
  if (!token) return <AuthStack />;

  // A password an admin set (new user, admin reset, or a resolved
  // forgot-password request) must be changed before anything else in the
  // app is usable.
  if (user?.mustChangePassword) return <ChangePasswordScreen />;

  return <AppDrawer />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
