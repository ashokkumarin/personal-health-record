import { useState } from "react";
import { View } from "react-native";
import { Appbar, Avatar, Divider, Menu, Text, useTheme } from "react-native-paper";
import { DrawerActions } from "@react-navigation/native";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authContext";

const TITLES: Record<string, string> = {
  Timeline: "PHR",
  FamilyDetail: "Family",
  FamilyTimeline: "Health Record",
  Upload: "Upload a document",
  Settings: "Settings",
  Profile: "Profile",
  RecordViewer: "Document",
};

export default function TopBanner({ navigation, route, options }: NativeStackHeaderProps) {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = options.title ?? TITLES[route.name] ?? "PHR";

  function go(screen: keyof typeof TITLES) {
    setMenuOpen(false);
    navigation.navigate(screen as never);
  }

  function handleLogout() {
    setMenuOpen(false);
    logout();
  }

  return (
    <Appbar.Header elevated style={{ backgroundColor: theme.colors.primary }}>
      {navigation.canGoBack() ? (
        <Appbar.BackAction color={theme.colors.onPrimary} onPress={() => navigation.goBack()} />
      ) : (
        <Appbar.Action
          icon="menu"
          color={theme.colors.onPrimary}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        />
      )}
      <Appbar.Content title={title} titleStyle={{ color: theme.colors.onPrimary }} />
      {options.headerRight?.({ canGoBack: navigation.canGoBack(), tintColor: theme.colors.onPrimary })}
      <Menu
        visible={menuOpen}
        onDismiss={() => setMenuOpen(false)}
        anchor={
          <Appbar.Action
            icon={() =>
              user?.avatarUrl ? (
                <Avatar.Image size={32} source={{ uri: user.avatarUrl }} />
              ) : (
                <Avatar.Text size={32} label={(user?.name ?? "?").charAt(0).toUpperCase()} />
              )
            }
            onPress={() => setMenuOpen(true)}
          />
        }
      >
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text variant="labelLarge">{user?.name}</Text>
        </View>
        <Divider />
        <Menu.Item leadingIcon="account" title="Profile" onPress={() => go("Profile")} />
        <Menu.Item leadingIcon="cog" title="Settings" onPress={() => go("Settings")} />
        <Divider />
        <Menu.Item leadingIcon="logout" title="Log out" onPress={handleLogout} />
      </Menu>
    </Appbar.Header>
  );
}
