import { View, StyleSheet } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useAuth } from "../lib/authContext";
import AuthStack from "./AuthStack";
import AppDrawer from "./AppDrawer";

export default function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return token ? <AppDrawer /> : <AuthStack />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
