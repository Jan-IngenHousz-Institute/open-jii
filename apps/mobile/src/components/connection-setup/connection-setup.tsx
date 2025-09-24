import React from "react";
import { useAsync } from "react-async-hook";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { getConnectedDevice } from "~/services/device-connection-manager/device-connection-manager";

import { ConnectionTypeRow } from "./components/connection-type-row";
import { DeviceList } from "./components/device-list";
import { useConnectionSetup } from "./hooks/use-connection-setup";

export function ConnectionSetup() {
  const theme = useTheme();
  const { colors } = theme;
  const {
    selectedConnectionType,
    setSelectedConnectionType,
    loadingDevices,
    connectingDeviceId,
    devices,
    handleScanForDevices,
    handleConnectToDevice,
  } = useConnectionSetup();

  const { result, execute } = useAsync(() => getConnectedDevice(), []);

  console.log("result", result);

  const showDeviceList = loadingDevices || !!devices?.length;

  return (
    <View>
      <Text
        style={[
          styles.sectionTitle,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
        ]}
      >
        Connect to Device
      </Text>

      <ConnectionTypeRow
        selectedType={selectedConnectionType}
        onSelectType={setSelectedConnectionType}
      />

      <View style={styles.actionsContainer}>
        <Button
          title="Scan for Devices"
          onPress={handleScanForDevices}
          isLoading={loadingDevices}
          isDisabled={!selectedConnectionType || !!connectingDeviceId}
          style={styles.actionButton}
        />
      </View>

      {showDeviceList && (
        <DeviceList
          devices={devices ?? []}
          loading={loadingDevices}
          connectingDeviceId={connectingDeviceId}
          onConnect={handleConnectToDevice}
        />
      )}

      <Button title="Refresh connection" onPress={() => execute()} style={styles.actionButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});
