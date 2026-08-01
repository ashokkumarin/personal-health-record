import { StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";

interface Props {
  count: number;
  downloading: boolean;
  onCancel: () => void;
  onDownload: () => void;
}

export default function SelectionBar({ count, downloading, onCancel, onDownload }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <IconButton icon="close" onPress={onCancel} />
        <Text variant="titleMedium">{count} selected</Text>
      </View>
      <IconButton icon="download" disabled={count === 0} loading={downloading} onPress={onDownload} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center" },
});
