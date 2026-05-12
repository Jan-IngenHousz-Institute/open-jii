import React from "react";
import { View, Text } from "react-native";
import { toast } from "sonner-native";
import { Button } from "~/components/Button";
import {
  useAllDevices,
  useConnectedDevice,
  useConnectToDevice,
  usePairedDevices,
  useSerialDevices,
} from "~/services/device-connection-manager/device-connection-hooks";

import { ConnectedDevice } from "./components/connected-device";
import { DeviceList } from "./components/device-list";

export function ConnectionSetup() {
  const { data: device } = useConnectedDevice();
  const { data: devices = [], refetch: refreshDevices, isFetching } = useAllDevices();

  const { connectToDevice, connectingDeviceId, disconnectFromDevice, unpairDevice } =
    useConnectToDevice();
  const { data: pairedDevices = [] } = usePairedDevices();
  const { data: serialDevices = [] } = useSerialDevices();

  const showDeviceList = !device && (isFetching || !!devices?.length);

  return (
    <View>
      <Text className="text-on-surface mb-4 text-lg font-bold">Device connection</Text>

      {device && (
        <ConnectedDevice
          device={device}
          onDisconnect={async (device) => {
            try {
              await disconnectFromDevice(device);
            } catch (e) {
              console.log("connection error", e);
              toast.error("Could not disconnect");
            }
          }}
        />
      )}

      <View className="mb-6 flex-row justify-between">
        {!device && (
          <Button
            title="Scan for Devices"
            onPress={() => refreshDevices()}
            isLoading={isFetching}
            isDisabled={isFetching || !!connectingDeviceId}
            style={{ flex: 1, marginHorizontal: 4 }}
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
              toast.error("Could not disconnect");
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
            await connectToDevice(device);
          } catch {
            toast.error("Could not connect");
          }
        }}
      />
    </View>
  );
}
