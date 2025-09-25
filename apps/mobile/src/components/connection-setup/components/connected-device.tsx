import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { useTheme } from "~/hooks/use-theme";
import type { Device } from "~/types/device";

interface Props {
  device: Device;
  onDisconnect?: (device: Device) => void | Promise<void>;
}

export function ConnectedDevice(props: Props) {
  const { device, onDisconnect } = props;
  const theme = useTheme();
  const { colors, isDark } = theme;

  const onSurface = isDark ? colors.dark.onSurface : colors.light.onSurface;
  const surface = isDark ? colors.dark.surface : colors.light.surface;
  const accent = isDark ? colors.dark.primary : colors.light.primary;

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
