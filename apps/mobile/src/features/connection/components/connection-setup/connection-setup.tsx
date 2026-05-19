import React from "react";
import { View, Text } from "react-native";
import { toast } from "sonner-native";
import {
  useAllDevices,
  useConnectedDevice,
  useConnectToDevice,
  usePairedDevices,
  useSerialDevices,
} from "~/features/connection/hooks/use-device-connection";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

import { ConnectedDevice } from "./components/connected-device";
import { DeviceList } from "./components/device-list";

export function ConnectionSetup() {
  const { t } = useTranslation(["common", "connection"]);
  const { data: device } = useConnectedDevice();
  const { data: devices = [], refetch: refreshDevices, isFetching } = useAllDevices();

  const { connectToDevice, connectingDeviceId, disconnectFromDevice, unpairDevice } =
    useConnectToDevice();
  const { data: pairedDevices = [] } = usePairedDevices();
  const { data: serialDevices = [] } = useSerialDevices();

  const showDeviceList = !device && (isFetching || !!devices?.length);

  return (
    <View>
      <Text className="text-on-surface mb-4 text-lg font-bold">{t("connection:setup.title")}</Text>

      {device && (
        <ConnectedDevice
          device={device}
          onDisconnect={async (device) => {
            try {
              await disconnectFromDevice(device);
            } catch (e) {
              console.log("connection error", e);
              toast.error(t("connection:setup.errorDisconnect"));
            }
          }}
        />
      )}

      <View className="mb-6 flex-row justify-between">
        {!device && (
          <Button
            title={t("connection:setup.scanButton")}
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
          title={t("connection:deviceList.nearbyTitle")}
          onConnect={async (device) => {
            try {
              await connectToDevice(device);
            } catch (e) {
              console.log("connection error", e);
              toast.error(t("connection:setup.errorDisconnect"));
            }
          }}
        />
      )}
      <DeviceList
        devices={[...pairedDevices, ...serialDevices]}
        title={t("connection:deviceList.pairedTitle")}
        loading={false}
        connectingDeviceId={connectingDeviceId}
        onDelete={(device) => unpairDevice(device)}
        onConnect={async (device) => {
          try {
            await connectToDevice(device);
          } catch {
            toast.error(t("connection:setup.errorConnect"));
          }
        }}
      />
    </View>
  );
}
