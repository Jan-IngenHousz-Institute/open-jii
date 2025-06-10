import { Bluetooth, Radio, Usb } from "lucide-react-native";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

interface Device {
  id: string;
  name: string;
  rssi?: number | null;
  type: "bluetooth" | "ble" | "usb";
}

interface DeviceListProps {
  devices: Device[];
  isScanning: boolean;
  onConnectToDevice: (device: Device) => void;
}

export function DeviceList({
  devices,
  isScanning,
  onConnectToDevice,
}: DeviceListProps) {
  const theme = useTheme();

  const renderDeviceItem = ({ item }: { item: Device }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        {
          backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
        },
      ]}
      onPress={() => onConnectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text
          style={[
            styles.deviceName,
            {
              color: theme.isDark
                ? colors.dark.onSurface
                : colors.light.onSurface,
            },
          ]}
        >
          {item.name}
        </Text>
        {item.rssi && (
          <Text
            style={[
              styles.deviceRssi,
              {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            Signal:{" "}
            {item.rssi > -70 ? "Strong" : item.rssi > -80 ? "Medium" : "Weak"}
          </Text>
        )}
      </View>
      <View style={styles.deviceTypeContainer}>
        {item.type === "bluetooth" && (
          <Bluetooth size={16} color={colors.primary.dark} />
        )}
        {item.type === "ble" && <Radio size={16} color={colors.primary.dark} />}
        {item.type === "usb" && <Usb size={16} color={colors.primary.dark} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.deviceListContainer}>
      <Text
        style={[
          styles.deviceListTitle,
          {
            color: theme.isDark
              ? colors.dark.onSurface
              : colors.light.onSurface,
          },
        ]}
      >
        {isScanning ? "Scanning for devices..." : "Available Devices"}
      </Text>

      {!isScanning && devices.length === 0 && (
        <Text
          style={[
            styles.emptyDeviceList,
            {
              color: theme.isDark
                ? colors.dark.inactive
                : colors.light.inactive,
            },
          ]}
        >
          No devices found. Try scanning again.
        </Text>
      )}

      <FlatList
        data={devices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.deviceList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  deviceListContainer: {
    marginBottom: 24,
  },
  deviceListTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  deviceList: {
    paddingBottom: 8,
  },
  deviceItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "500",
  },
  deviceRssi: {
    fontSize: 12,
    marginTop: 4,
  },
  deviceTypeContainer: {
    padding: 8,
  },
  emptyDeviceList: {
    textAlign: "center",
    padding: 16,
  },
});
