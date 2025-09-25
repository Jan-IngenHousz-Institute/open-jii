import { useAsync, useAsyncCallback } from "react-async-hook";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useMacros } from "~/hooks/use-macros";
import { useProtocols } from "~/hooks/use-protocols";
import { useSessionStore } from "~/hooks/use-session-store";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-manager";
import { bluetoothDeviceToMultispeqStream } from "~/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { MultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { Device } from "~/types/device";
import { processScan } from "~/utils/process-scan/process-scan";

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
  const { macros } = useMacros();
  const { session } = useSessionStore();
  const { protocols } = useProtocols();
  const { setBatteryLevel } = useDeviceConnectionStore();

  const userId = session?.data.user.id;

  const {
    execute: executeScan,
    reset,
    loading: isScanning,
    error,
    result,
  } = useAsyncCallback(async (protocolId: string, macroId: string) => {
    const protocolCode = protocols?.find((p) => p.value === protocolId)?.code;
    if (!protocolCode) {
      return;
    }

    const macro = macros?.find((m) => m.value === macroId);

    const result = await executeCommand(protocolCode);
    setBatteryLevel((result as any)?.device_battery);
    if (typeof result !== "object") {
      throw new Error("Invalid result");
    }
    console.log("got result, processing...");
    return processScan(result, userId, macro?.filename, macro?.code);
  });

  return {
    executeScan,
    reset,
    isScanning,
    error,
    result,
    executeCommand,
  };
}
