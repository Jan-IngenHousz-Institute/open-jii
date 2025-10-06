import React from "react";
// import { useAsync } from "react-async-hook";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
// import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useTheme } from "~/hooks/use-theme";
// import { useScannerCommandExecutor } from "~/services/scan-manager/scan-manager";
import type { Device } from "~/types/device";

// import { delay } from "~/utils/delay";

interface Props {
  device: Device;
  onDisconnect?: (device: Device) => void | Promise<void>;
}

// const dummyProtocol = [
//   {
//     _protocol_set_: [
//       {
//         label: "spad",
//         spad: [[2, 3, 6], [-1]],
//         protocol_repeats: 1,
//       },
//     ],
//   },
// ];

export function ConnectedDevice(props: Props) {
  const { device, onDisconnect } = props;
  const theme = useTheme();
  const { colors, isDark } = theme;
  // const { executeCommand } = useScannerCommandExecutor();
  // const { setBatteryLevel } = useDeviceConnectionStore();

  // useAsync(async () => {
  //   await delay(1000);
  //   const response = await executeCommand(dummyProtocol);
  //   if (!response) {
  //     return;
  //   }
  //   setBatteryLevel((response as any).device_batery);
  // }, []);

  const onSurface = isDark ? colors.dark.onSurface : colors.light.onSurface;
  const surface = isDark ? colors.dark.surface : colors.light.surface;
  const accent = isDark ? colors.primary.bright : colors.primary.dark;

  return (
    <Card style={[styles.card, { backgroundColor: surface }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: onSurface }]}>Connected Device</Text>
        <View style={[styles.badge, { backgroundColor: accent + "22" }]}>
          <Text style={[styles.badgeText, { color: accent }]}>Connected</Text>
        </View>
      </View>
      <Text style={[styles.name, { color: onSurface }]}>{device.name}</Text>
      <Text style={[styles.meta, { color: onSurface + "99" }]}>
        {device.type} • {device.id}
      </Text>
      {!!onDisconnect && (
        <View style={styles.actions}>
          <Button title="Disconnect" onPress={() => onDisconnect(device)} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
  },
  actions: {
    marginTop: 12,
  },
});
