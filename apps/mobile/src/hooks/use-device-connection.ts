import { useEffect, useState } from "react";
import { useAsyncCallback } from "react-async-hook";
import { Device } from "~/hooks/use-devices";
import { bluetoothDeviceToMultispeqStream } from "~/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { connectWithBluetoothDevice } from "~/services/multispeq-communication/android-bluetooth-connection/connect-with-bluetooth-device";
import { MultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";

async function connectToDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    const bluetoothDevice = await connectWithBluetoothDevice(device.id);
    return new MultispeqCommandExecutor(bluetoothDeviceToMultispeqStream(bluetoothDevice));
  }

  return undefined;
}

export function useDeviceConnection() {
  const [connectingDeviceId, setconnectingDeviceId] = useState<string>();
  const [multispeqExecutor, setMultispeqExecutor] = useState<MultispeqCommandExecutor>();
  const [scanTimestamp, setScanTimestamp] = useState<string>();

  const { error: connectError, execute: connect } = useAsyncCallback(async (device: Device) => {
    setconnectingDeviceId(device.id);

    try {
      await multispeqExecutor?.destroy();
    } catch {
      // ignore
    }

    try {
      setMultispeqExecutor(await connectToDevice(device));
    } finally {
      setconnectingDeviceId(undefined);
    }
  });

  const {
    execute: executeScan,
    reset,
    loading: isScanning,
    result: scanResult,
  } = useAsyncCallback((command: string | object) => multispeqExecutor?.execute(command));

  async function scan(command: string | object) {
    reset();
    const result = await executeScan(command);
    setScanTimestamp(new Date().toISOString());
    return result;
  }

  useEffect(() => {
    return () => {
      multispeqExecutor?.destroy();
    };
  }, [multispeqExecutor]);

  async function disconnect() {
    reset();
    setMultispeqExecutor(undefined);
    try {
      await multispeqExecutor?.destroy();
    } catch {
      // ignored
    }
  }

  return {
    connectingDeviceId,
    connectError,
    connect,
    canScan: !!multispeqExecutor,
    isScanning,
    measurementData: scanResult,
    performMeasurement: scan,
    disconnect,
    clearResult: reset,
    measurementTimestamp: scanTimestamp,
  };
}
