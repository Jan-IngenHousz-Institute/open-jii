import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "~/components/Button";
import { useToast } from "~/context/toast-context";
import { useTheme } from "~/hooks/use-theme";
import {
  useAllDevices,
  useConnectedDevice,
  useConnectToDevice,
  usePairedDevices,
  useSerialDevices,
} from "~/services/device-connection-manager/device-connection-manager";

import { ConnectedDevice } from "./components/connected-device";
import { DeviceList } from "./components/device-list";

export function ConnectionSetup() {
  const theme = useTheme();
  const { colors } = theme;

  const { data: device } = useConnectedDevice();
  const { data: devices = [], refetch: refreshDevices, isFetching } = useAllDevices();
  const { connectToDevice, connectingDeviceId, disconnectFromDevice, unpairDevice } =
    useConnectToDevice();
  const { showToast } = useToast();
  const { data: pairedDevices = [] } = usePairedDevices();
  const { data: serialDevices = [] } = useSerialDevices();

  const showDeviceList = !device && (isFetching || !!devices?.length);

  return (
    <View>
      <Text
        style={[
          styles.sectionTitle,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
        ]}
      >
        Device connection
      </Text>

      {device && (
        <ConnectedDevice
          device={device}
          onDisconnect={async (device) => {
            try {
              await disconnectFromDevice(device);
            } catch (e) {
              console.log("connection error", e);
              showToast("Could not disconnect", "error");
            }
          }}
        />
      )}

      <View style={styles.actionsContainer}>
        {!device && (
          <Button
            title="Scan for Devices"
            onPress={() => refreshDevices()}
            isLoading={isFetching}
            isDisabled={isFetching || !!connectingDeviceId}
            style={styles.actionButton}
          />
        )}
      </View>

      {showDeviceList && (
        <DeviceList
          devices={isFetching ? [] : devices}
          loading={isFetching}
          connectingDeviceId={connectingDeviceId}
          title="Nearby Devices"
          onConnect={async (device) => {
            try {
              await connectToDevice(device);
            } catch (e) {
              console.log("connection error", e);
              showToast("Could not disconnect", "error");
            }
          }}
        />
      )}
      <DeviceList
        devices={[...pairedDevices, ...serialDevices]}
        title="Paired Devices"
        loading={false}
        connectingDeviceId={connectingDeviceId}
        onDelete={(device) => unpairDevice(device)}
        onConnect={async (device) => {
          try {
            console.log("device", device);
            await connectToDevice(device);
          } catch {
            showToast("Could not connect", "error");
          }
        }}
      />
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
