import { useEffect, useState } from "react";
import { useAsyncCallback } from "react-async-hook";
import { useToast } from "~/context/toast-context";
import { Device } from "~/hooks/use-devices";
import { getProtocolDefinition, ProtocolName } from "~/protocols/definitions";
import { bluetoothDeviceToMultispeqStream } from "~/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { connectWithBluetoothDevice } from "~/services/multispeq-communication/android-bluetooth-connection/connect-with-bluetooth-device";
import { openSerialPortConnection } from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import { serialPortToMultispeqStream } from "~/services/multispeq-communication/android-serial-port-connection/serial-port-to-multispeq-stream";
import { MockCommandExecutor } from "~/services/multispeq-communication/mock-device/mock-command-executor";
import {
  IMultispeqCommandExecutor,
  MultispeqCommandExecutor,
} from "~/services/multispeq-communication/multispeq-command-executor";

async function connectToDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    const bluetoothDevice = await connectWithBluetoothDevice(device.id);
    return new MultispeqCommandExecutor(bluetoothDeviceToMultispeqStream(bluetoothDevice));
  }

  if (device.type === "usb") {
    const serialPortDevice = await openSerialPortConnection(parseInt(device.id));
    return new MultispeqCommandExecutor(serialPortToMultispeqStream(serialPortDevice));
  }

  if (device.type === "mock-device") {
    return new MockCommandExecutor();
  }

  return undefined;
}

export function useDeviceConnection() {
  const [connectingDeviceId, setconnectingDeviceId] = useState<string>();
  const [multispeqExecutor, setMultispeqExecutor] = useState<IMultispeqCommandExecutor>();
  const [measurementTimestamp, setMeasurementTimestamp] = useState<string>();
  const { showToast } = useToast();

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
    result: measurementData,
  } = useAsyncCallback(async ({ analyze, protocol }) => {
    const result = await multispeqExecutor?.execute(protocol);

    if (typeof result !== "object") {
      console.log("not object");
      return result;
    }

    if (!("sample" in result)) {
      console.log("no sample key");
      return result;
    }

    const { sample } = result;

    if (!sample) {
      console.log("on sample value");
      return result;
    }

    const samples = Array.isArray(sample) ? sample : [sample];

    try {
      const output = samples.map(analyze);
      const timestamp = new Date().toISOString();
      setMeasurementTimestamp(timestamp);
      return { ...result, timestamp, output };
    } catch (error: any) {
      showToast("Could not process measurement information " + error.message, "warning");
      return result;
    }
  });

  function performMeasurement(protocolName: ProtocolName | undefined) {
    reset();
    const protocolDefinition = protocolName && getProtocolDefinition(protocolName);
    if (!protocolDefinition) {
      return;
    }

    console.log("protocolName", protocolName);
    return executeScan(protocolDefinition);
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
    isConnected: !!multispeqExecutor,
    isScanning,
    measurementData,
    performMeasurement,
    disconnect,
    clearResult: reset,
    measurementTimestamp,
  };
}
