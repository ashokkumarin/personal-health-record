import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { DrawerContentScrollView, useDrawerStatus } from "@react-navigation/drawer";
import { List, Text } from "react-native-paper";
import type { FamilyDetail } from "@phr/shared";
import { useApi } from "../lib/useApi";

export default function DrawerContent(props: DrawerContentComponentProps) {
  const api = useApi();
  const isOpen = useDrawerStatus() === "open";
  const [families, setFamilies] = useState<FamilyDetail[] | null>(null);

  useEffect(() => {
    if (!api || !isOpen) return;
    let cancelled = false;
    api.familyClient
      .listFamilies()
      .then((list) => Promise.all(list.map((f) => api.familyClient.getFamily(f.id))))
      .then((detailed) => {
        if (!cancelled) setFamilies(detailed);
      })
      .catch(() => {
        if (!cancelled) setFamilies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [api, isOpen]);

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  hint: { padding: 16, opacity: 0.6 },
  emptyPatients: { paddingLeft: 56, paddingVertical: 8, opacity: 0.6 },
});
