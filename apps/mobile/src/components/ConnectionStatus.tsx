import {
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothOff,
  Usb,
} from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "~/hooks/useTheme";

interface ConnectionStatusProps {
  isOnline: boolean;
  bluetoothConnected: boolean;
  usbConnected: boolean;
  deviceName?: string;
  connectionType?: "bluetooth" | "ble" | "usb" | null;
}

export default function ConnectionStatus({
  isOnline,
  bluetoothConnected,
  usbConnected,
  deviceName,
  connectionType,
}: ConnectionStatusProps) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
        },
      ]}
    >
      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          {isOnline ? (
            <Wifi size={20} color={colors.semantic.success} />
          ) : (
            <WifiOff size={20} color={colors.semantic.error} />
          )}
          <Text
            style={[
              styles.statusText,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
              !isOnline && { color: colors.semantic.error },
            ]}
          >
            {isOnline ? "Online" : "Offline"}
          </Text>
        </View>

        <View style={styles.statusItem}>
          {bluetoothConnected ? (
            <Bluetooth size={20} color={colors.semantic.success} />
          ) : (
            <BluetoothOff
              size={20}
              color={
                theme.isDark ? colors.dark.inactive : colors.light.inactive
              }
            />
          )}
          <Text
            style={[
              styles.statusText,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
              !bluetoothConnected && {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            {bluetoothConnected ? "Connected" : "Disconnected"}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Usb
            size={20}
            color={
              usbConnected
                ? colors.semantic.success
                : theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive
            }
          />
          <Text
            style={[
              styles.statusText,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
              !usbConnected && {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            {usbConnected ? "Connected" : "Disconnected"}
          </Text>
        </View>
      </View>

      {(bluetoothConnected || usbConnected) && deviceName && (
        <View
          style={[
            styles.deviceInfo,
            {
              borderTopColor: theme.isDark
                ? colors.dark.border
                : colors.light.border,
            },
          ]}
        >
          <Text
            style={[
              styles.deviceInfoText,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
            ]}
          >
            Connected to:{" "}
            <Text style={[styles.deviceName, { color: colors.primary.dark }]}>
              {deviceName}
            </Text>
          </Text>
          <Text
            style={[
              styles.connectionTypeText,
              {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            via{" "}
            {connectionType === "bluetooth"
              ? "Bluetooth Classic"
              : connectionType === "ble"
                ? "Bluetooth LE"
                : connectionType === "usb"
                  ? "USB Serial"
                  : "Unknown"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statusText: {
    marginLeft: 6,
    fontSize: 14,
  },
  deviceInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  deviceInfoText: {
    fontSize: 14,
  },
  deviceName: {
    fontWeight: "bold",
  },
  connectionTypeText: {
    fontSize: 12,
    marginTop: 4,
  },
});
