import type { BluetoothDevice } from "react-native-bluetooth-classic";

import type { ITransportAdapter } from "@repo/iot";

/**
 * Wrap a connected Bluetooth Classic device as an `ITransportAdapter` so it can
 * drive the shared `@repo/iot` `MultispeqDriver`.
 *
 * `react-native-bluetooth-classic` reads with a `"\n"` delimiter and delivers
 * each complete device message via `onDataReceived` *without* the trailing
 * newline. `MultispeqDriver` frames on `"\n"`, so we re-append it per event —
 * one event is exactly one device message. This replaces the old bespoke
 * `bluetoothDeviceToMultispeqStream` framing (now handled by the driver).
 */
export function bluetoothClassicTransport(device: BluetoothDevice): ITransportAdapter {
  let onData: ((data: string) => void) | undefined;

  device.onDataReceived((event) => {
    if (typeof event.data !== "string") return;
    onData?.(event.data.endsWith("\n") ? event.data : `${event.data}\n`);
  });

  return {
    isConnected: () => true,
    async send(data: string) {
      const ok = await device.write(data);
      if (!ok) {
        throw new Error("Failed to write to device");
      }
    },
    onDataReceived(callback: (data: string) => void) {
      onData = callback;
    },
    onStatusChanged() {
      // Disconnect detection lives in use-device-connection
      // (RNBluetoothClassic.onDeviceDisconnected); nothing to wire here.
    },
    async disconnect() {
      await device.disconnect();
    },
  };
}
