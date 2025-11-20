import { Battery, Unplug } from "lucide-react-native";
import { useAsync } from "react-async-hook";
import { View, Text, Dimensions } from "react-native";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useTheme } from "~/hooks/use-theme";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-hooks";
import { useScannerCommandExecutor } from "~/services/scan-manager/use-scanner-command-executor";

export function DeviceConnectionWidget() {
  const { colors } = useTheme();
  const { batteryLevel, setBatteryLevel } = useDeviceConnectionStore();
  const { executeCommand } = useScannerCommandExecutor();
  const { data: connectedDevice } = useConnectedDevice();

  useAsync(async () => {
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

  const screenWidth = Dimensions.get("window").width;

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

  return (
    <View className="mr-4 items-end" style={{ maxWidth: screenWidth / 2 }}>
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
    </View>
  );
}
