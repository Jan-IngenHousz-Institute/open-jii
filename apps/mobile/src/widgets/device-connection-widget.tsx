import { Battery, Unplug } from "lucide-react-native";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useTheme } from "~/hooks/use-theme";

export function DeviceConnectionWidget() {
  const theme = useTheme();
  const { colors, typography } = theme;
  const { connectionType, batteryLevel } = useDeviceConnectionStore();
  const screenWidth = Dimensions.get("window").width;

  const isConnected = connectionType !== undefined;

  const getBatteryColor = () => {
    if (batteryLevel === undefined) return colors.semantic.warning;
    if (batteryLevel > 50) return colors.semantic.success;
    if (batteryLevel > 20) return colors.semantic.warning;
    return colors.semantic.error;
  };

  const getBatteryText = () => {
    if (batteryLevel === undefined) return "?%";
    return `${batteryLevel}%`;
  };

  return (
    <View style={[styles.container, { maxWidth: screenWidth / 2 }]}>
      <View
        style={[
          styles.connectionStatus,
          {
            backgroundColor: isConnected
              ? colors.semantic.success + "20"
              : colors.semantic.error + "20",
            borderColor: isConnected ? colors.semantic.success : colors.semantic.error,
          },
        ]}
      >
        {isConnected ? (
          <Battery size={16} color={getBatteryColor()} />
        ) : (
          <Unplug size={16} color={colors.semantic.error} />
        )}

        <Text
          style={[
            styles.connectionText,
            typography.caption,
            {
              color: isConnected ? colors.semantic.success : colors.semantic.error,
              fontSize: 11,
            },
          ]}
        >
          {isConnected ? "Connected" : "Not connected"}
        </Text>

        {isConnected && (
          <Text
            style={[
              styles.batteryText,
              typography.caption,
              {
                color: getBatteryColor(),
                fontSize: 10,
              },
            ]}
          >
            {getBatteryText()}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    marginRight: 16,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    minHeight: 24,
  },
  connectionText: {
    fontWeight: "600",
  },
  batteryText: {
    fontWeight: "500",
    marginLeft: 3,
  },
});
