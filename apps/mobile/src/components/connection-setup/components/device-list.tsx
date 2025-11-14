import { Bluetooth, Radio, Usb } from "lucide-react-native";
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useTheme } from "~/hooks/use-theme";
import { Device } from "~/types/device";

interface Props {
  devices: Device[];
  loading: boolean;
  connectingDeviceId?: string;
  onConnect: (device: Device) => void;
  onDelete?: (device: Device) => void;
  title: string;
}

export function DeviceList({
  devices,
  loading,
  connectingDeviceId,
  onConnect,
  onDelete,
  title,
}: Props) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.deviceListContainer}>
      <Text
        style={[
          styles.deviceListTitle,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
        ]}
      >
        {loading ? "Scanning for devices..." : title}
      </Text>

      {!loading && devices.length === 0 && (
        <Text
          style={[
            styles.emptyDeviceList,
            { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
          ]}
        >
          No devices found. Try scanning again.
        </Text>
      )}

      <FlatList
        data={devices}
        renderItem={({ item }) => {
          return (
            <Swipeable
              enabled={!!onDelete && item.type !== "usb"}
              renderRightActions={() => (
                <TouchableOpacity
                  style={[styles.deleteAction, { backgroundColor: colors.semantic.error }]}
                  onPress={() => onDelete?.(item)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.deleteText, { color: colors.light.onPrimary }]}>Delete</Text>
                </TouchableOpacity>
              )}
            >
              <TouchableOpacity
                style={[
                  styles.deviceItem,
                  { backgroundColor: theme.isDark ? colors.dark.card : colors.light.card },
                ]}
                onPress={() => onConnect(item)}
              >
                <View style={styles.deviceInfo}>
                  <Text
                    style={[
                      styles.deviceName,
                      { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
                    ]}
                  >
                    {item.name ?? "N/A"}
                  </Text>
                  {item.rssi && (
                    <Text
                      style={[
                        styles.deviceRssi,
                        { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
                      ]}
                    >
                      Signal: {item.rssi > -70 ? "Strong" : item.rssi > -80 ? "Medium" : "Weak"}
                    </Text>
                  )}
                </View>
                <View style={styles.deviceTypeContainer}>
                  {item.id === connectingDeviceId ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.isDark ? colors.light.onPrimary : colors.dark.onPrimary}
                    />
                  ) : (
                    <>
                      {item.type === "bluetooth-classic" && (
                        <Bluetooth size={16} color={colors.primary.dark} />
                      )}
                      {item.type === "ble" && <Radio size={16} color={colors.primary.dark} />}
                      {item.type === "usb" && <Usb size={16} color={colors.primary.dark} />}
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        }}
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
  deleteAction: {
    width: 88,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderRadius: 8,
  },
  deleteText: {
    fontWeight: "600",
  },
});
