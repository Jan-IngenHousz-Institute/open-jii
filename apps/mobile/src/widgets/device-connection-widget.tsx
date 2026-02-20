import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Battery, Unplug, RefreshCw, WifiOff } from "lucide-react-native";
import { useState } from "react";
import { useAsync } from "react-async-hook";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { toast } from "sonner-native";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useIsOnline } from "~/hooks/use-is-online";
import { useTheme } from "~/hooks/use-theme";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-hooks";
import { useScannerCommandExecutor } from "~/services/scan-manager/use-scanner-command-executor";
import { isOnline } from "~/utils/is-online";

export function DeviceConnectionWidget() {
  const { colors, classes } = useTheme();
  const queryClient = useQueryClient();
  const { batteryLevel, setBatteryLevel } = useDeviceConnectionStore();
  const { executeCommand } = useScannerCommandExecutor();
  const { data: connectedDevice } = useConnectedDevice();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: isOnlineStatus = true } = useIsOnline();

  useAsync(async () => {
    if (!connectedDevice) {
      return;
    }

    const batteryResponse = await executeCommand("battery");
    if (typeof batteryResponse !== "string") {
      return;
    }

    const batteryPercentage = parseInt(batteryResponse.replace("battery:", ""));
    if (isNaN(batteryPercentage)) {
      return;
    }
    setBatteryLevel(batteryPercentage);
  }, [connectedDevice?.id]);

  const isConnected = !!connectedDevice;

  const getBatteryColor = () => {
    if (batteryLevel === undefined) {
      return colors.semantic.warning;
    }

    if (batteryLevel > 50) {
      return colors.semantic.success;
    }

    if (batteryLevel > 20) {
      return colors.semantic.warning;
    }

    return colors.semantic.error;
  };

  const getBatteryText = () => {
    if (batteryLevel === undefined) return "?%";
    return `${batteryLevel}%`;
  };

  const handleRefresh = async () => {
    const online = await isOnline();
    if (!online) {
      toast.error("Refresh is not allowed in offline mode");
      return;
    }

    setIsRefreshing(true);
    try {
      await queryClient.resetQueries();
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <View className="flex-row items-center gap-2">
      <View
        className="flex-row items-center gap-0.5 rounded-lg border px-1.5 py-0.5"
        style={{
          backgroundColor: isConnected
            ? colors.semantic.success + "20"
            : colors.semantic.error + "20",
          borderColor: isConnected ? colors.semantic.success : colors.semantic.error,
          minHeight: 24,
        }}
      >
        {isConnected ? (
          <Battery size={16} color={getBatteryColor()} />
        ) : (
          <Unplug size={16} color={colors.semantic.error} />
        )}

        <Text
          className="text-[11px] font-semibold"
          style={{
            color: isConnected ? colors.semantic.success : colors.semantic.error,
          }}
        >
          {isConnected ? "Connected" : "Not connected"}
        </Text>

        {isConnected && (
          <Text
            className="ml-0.5 text-[10px] font-medium"
            style={{
              color: getBatteryColor(),
            }}
          >
            {getBatteryText()}
          </Text>
        )}
      </View>

      <TouchableOpacity
        key={Date.now()}
        onPress={isOnlineStatus ? handleRefresh : undefined}
        disabled={isRefreshing || !isOnlineStatus}
        className={clsx("items-center justify-center rounded-full shadow-lg", classes.card)}
        style={{
          width: 36,
          height: 36,
          backgroundColor: isOnlineStatus ? colors.primary.dark : colors.semantic.error,
        }}
        activeOpacity={0.7}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : isOnlineStatus ? (
          <RefreshCw size={16} color={colors.onPrimary} />
        ) : (
          <WifiOff size={16} color={colors.onPrimary} />
        )}
      </TouchableOpacity>
    </View>
  );
}
