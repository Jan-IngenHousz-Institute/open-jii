import { useAsync, useAsyncCallback } from "react-async-hook";
import RNBluetoothClassic, { BluetoothDevice } from "react-native-bluetooth-classic";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-manager";
import { bluetoothDeviceToMultispeqStream } from "~/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { MultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { Device } from "~/types/device";

async function createBluetoothMultiseqCommandExecutor(device: Device | undefined) {
  if (!device) {
    return undefined;
  }

  const bluetoothDevice = await RNBluetoothClassic.getConnectedDevice(device.id);
  return new MultispeqCommandExecutor(bluetoothDeviceToMultispeqStream(bluetoothDevice));
}

async function createMultispeqCommandExecutor(device: Device | undefined) {
  if (!device) {
    return undefined;
  }

  if (device.type === "bluetooth-classic") {
    return createBluetoothMultiseqCommandExecutor(device);
  }

  throw new Error("Unsupported device type");
}

export function useScanner() {
  const { data: device } = useConnectedDevice();
  const { result: commandExecutor } = useAsync(
    () => createMultispeqCommandExecutor(device ?? undefined),
    [device?.id],
  );

  const {
    result: measurementResult,
    reset,
    loading: isMeasuring,
    error,
    execute: performMeasurement,
  } = useAsyncCallback((command: string | object) => commandExecutor?.execute(command));

  return { measurementResult, reset, isMeasuring, error, performMeasurement };
}
