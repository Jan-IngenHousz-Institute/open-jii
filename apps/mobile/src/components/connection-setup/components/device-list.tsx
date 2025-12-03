import { clsx } from "clsx";
import { Bluetooth, Radio, Usb, Trash2 } from "lucide-react-native";
import React, { useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
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
  const { colors, classes } = useTheme();

  const renderKey = useMemo(() => Date.now(), [connectingDeviceId]);

  return (
    <View className="mb-6">
      <Text className={clsx("mb-3 text-base font-bold", classes.text)}>
        {loading ? "Scanning for devices..." : title}
      </Text>

      {!loading && devices.length === 0 && (
        <Text className={clsx("py-4 text-center", classes.textMuted)}>
          No devices found. Try scanning again.
        </Text>
      )}

      <FlatList
        data={devices}
        extraData={connectingDeviceId}
        renderItem={({ item }) => {
          const showDeleteButton = !!onDelete && item.type !== "usb";
          const isConnecting = item.id === connectingDeviceId;

          return (
            <TouchableOpacity
              className={clsx(
                "mb-2 flex-row items-center justify-between rounded-lg p-3",
                classes.card,
              )}
              onPress={() => !isConnecting && onConnect(item)}
              activeOpacity={isConnecting ? 1 : 0.7}
              disabled={isConnecting}
              style={{ opacity: isConnecting ? 0.6 : 1 }}
            >
              <View className="flex-1">
                <Text className={clsx("text-base font-medium", classes.text)}>
                  {item.name ?? "N/A"}
                </Text>
                {item.rssi && (
                  <Text className={clsx("mt-1 text-xs", classes.textMuted)}>
                    Signal: {item.rssi > -70 ? "Strong" : item.rssi > -80 ? "Medium" : "Weak"}
                  </Text>
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <View className="p-2">
                  {isConnecting ? (
                    <ActivityIndicator size="small" color={colors.primary.dark} />
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
                {showDeleteButton && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      onDelete?.(item);
                    }}
                    className="h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: colors.semantic.error }}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => `${item.id}-${renderKey}`}
        contentContainerStyle={{ paddingBottom: 8 }}
      />
    </View>
  );
}
