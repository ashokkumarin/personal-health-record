import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./lib/authContext";
import { createAppTheme, DEFAULT_BANNER_COLOR } from "./lib/theme";
import RootNavigator from "./navigation/RootNavigator";

function Themed() {
  const { user } = useAuth();
  const theme = createAppTheme(user?.themeColor ?? DEFAULT_BANNER_COLOR);

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Themed />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
