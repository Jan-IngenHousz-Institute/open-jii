import { useState } from "react";
import { useAsyncCallback } from "react-async-hook";
import { Device } from "~/hooks/use-devices";
import { connectWithBluetoothDevice } from "~/services/multispeq-communication/android-bluetooth-connection/connect-with-bluetooth-device";

export function useDeviceConnection() {
  const [deviceId, setDeviceId] = useState<string>();

  const {
    error,
    execute: connectToDevice,
    result: connectedDevice,
  } = useAsyncCallback(async (device: Device) => {
    setDeviceId(device.id);
    await connectWithBluetoothDevice(device.id).finally(() => setDeviceId(undefined));
    return device;
  });

  return { connectingDeviceId: deviceId, error, connectToDevice, connectedDevice };
}
