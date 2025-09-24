import { useAsync, useAsyncCallback } from "react-async-hook";
import RNBluetoothClassic, { BluetoothDevice } from "react-native-bluetooth-classic";
import { getProtocolDefinition, ProtocolName } from "~/protocols/definitions";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-manager";
import { bluetoothDeviceToMultispeqStream } from "~/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { MultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { Device } from "~/types/device";
import { processMeasurement } from "~/utils/process-measurement";

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

export function useScannerCommandExecutor() {
  const { data: device } = useConnectedDevice();
  const { result: commandExecutor } = useAsync(
    () => createMultispeqCommandExecutor(device ?? undefined),
    [device?.id],
  );

  const {
    result: commandResponse,
    reset,
    loading: isExecuting,
    error,
    execute: executeCommand,
  } = useAsyncCallback((command: string | object) => commandExecutor?.execute(command));

  return {
    commandResponse,
    reset,
    isExecuting,
    error,
    executeCommand,
  };
}

export function useScanner() {
  const { executeCommand } = useScannerCommandExecutor();

  async function performScan(protocolName: ProtocolName) {
    const { protocol, analyze } = getProtocolDefinition(protocolName);
    const result = await executeCommand(protocol);
    if (typeof result !== "object") {
      throw new Error("Invalid result");
    }
    return processMeasurement(result, analyze as any);
  }

  const {
    execute: executeScan,
    reset,
    loading: isScanning,
    error,
    result,
  } = useAsyncCallback(performScan);

  return {
    executeScan,
    reset,
    isScanning,
    error,
    result,
  };
}
