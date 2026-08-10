import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { DrawerContentScrollView, useDrawerStatus } from "@react-navigation/drawer";
import { Button, Divider, List, Text } from "react-native-paper";
import type { FamilyDetail } from "@phr/shared";
import { useApi } from "../lib/useApi";
import { useAuth } from "../lib/authContext";
import { useServerConfig } from "../lib/serverConfigContext";
import { getLocalFamiliesForDrawer } from "../lib/data/families";

function connectionStatusLabel(
  mode: "server" | "standalone" | null,
  serverUrl: string | null,
  serverReachable: boolean | null
): string {
  if (mode === "standalone") return "Offline mode";
  if (mode === "server" && serverUrl) {
    return serverReachable === false ? `Offline — ${serverUrl} unreachable` : `Connected to ${serverUrl}`;
  }
  return "";
}

export default function DrawerContent(props: DrawerContentComponentProps) {
  const api = useApi();
  const { logout } = useAuth();
  const serverConfig = useServerConfig();
  const isOpen = useDrawerStatus() === "open";
  const [families, setFamilies] = useState<FamilyDetail[] | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    if (!api) {
      getLocalFamiliesForDrawer().then((list) => {
        if (!cancelled) setFamilies(list);
      });
      return () => {
        cancelled = true;
      };
    }

    api.familyClient
      .listFamilies()
      .then((list) => Promise.all(list.map((f) => api.familyClient.getFamily(f.id))))
      .then((detailed) => {
        if (!cancelled) setFamilies(detailed);
      })
      .catch(() => {
        // Live fetch failed (server temporarily unreachable) — fall back to
        // whatever this device already has cached from the last sync.
        getLocalFamiliesForDrawer().then((list) => {
          if (!cancelled) setFamilies(list);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [api, isOpen]);

  const statusLabel = connectionStatusLabel(serverConfig.mode, serverConfig.serverUrl, serverConfig.serverReachable);

  async function handleDisconnect() {
    setDisconnecting(true);
    await serverConfig.setStandalone();
    setDisconnecting(false);
  }

  function go(familyId: string, patientId?: string) {
    props.navigation.closeDrawer();
    if (patientId) {
      props.navigation.navigate("Main", { screen: "FamilyTimeline", params: { familyId, patientId } });
    } else {
      props.navigation.navigate("Main", { screen: "FamilyDetail", params: { familyId } });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
        {statusLabel !== "" && (
          <Text style={styles.status} variant="bodySmall">
            {statusLabel}
          </Text>
        )}
        {families === null && (
          <Text style={styles.hint} variant="bodyMedium">
            Loading...
          </Text>
        )}
        {families?.length === 0 && (
          <Text style={styles.hint} variant="bodyMedium">
            You don&apos;t belong to any families yet.
          </Text>
        )}
        {families?.map((family) => (
          <List.Accordion
            key={family.id}
            title={family.name}
            titleStyle={{ fontWeight: "600" }}
            left={(p) => <List.Icon {...p} icon="account-group" />}
            onPress={() => go(family.id)}
            expanded
          >
            {family.patients.length > 0 ? (
              family.patients.map((patient) => (
                <List.Item
                  key={patient.id}
                  title={patient.name}
                  left={(p) => <List.Icon {...p} icon="account" />}
                  onPress={() => go(family.id, patient.id)}
                />
              ))
            ) : (
              <Text style={styles.emptyPatients} variant="bodySmall">
                No patient profiles yet.
              </Text>
            )}
          </List.Accordion>
        ))}
      </DrawerContentScrollView>
      {serverConfig.mode === "server" && (
        <>
          <Divider />
          <Button mode="text" onPress={logout} style={styles.footerButton} textColor="#c62828">
            Log out
          </Button>
          <Button
            mode="text"
            onPress={handleDisconnect}
            loading={disconnecting}
            style={styles.footerButton}
            textColor="#c62828"
          >
            Disconnect and use this device offline
          </Button>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  status: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, opacity: 0.6 },
  hint: { padding: 16, opacity: 0.6 },
  footerButton: { justifyContent: "flex-start" },
  emptyPatients: { paddingLeft: 56, paddingVertical: 8, opacity: 0.6 },
});
