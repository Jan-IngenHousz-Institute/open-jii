import type { BluetoothDevice } from "react-native-bluetooth-classic";
import RNBluetoothClassic from "react-native-bluetooth-classic";

import type { ITransportAdapter } from "@repo/iot";

/**
 * Wrap a connected Bluetooth Classic device as an `ITransportAdapter` so it can
 * drive the shared `@repo/iot` `MultispeqDriver`.
 *
 * `react-native-bluetooth-classic` reads with a `"\n"` delimiter and delivers
 * each complete device message via `onDataReceived` *without* the trailing
 * newline. `MultispeqDriver` frames on `"\n"`, so we re-append it per event:
 * one event is exactly one device message.
 */
export function bluetoothClassicTransport(device: BluetoothDevice): ITransportAdapter {
  let onData: ((data: string) => void) | undefined;
  let onStatus: ((connected: boolean, error?: Error) => void) | undefined;
  let connected = true;

  const dataSub = device.onDataReceived((event) => {
    if (typeof event.data !== "string") return;
    onData?.(event.data.endsWith("\n") ? event.data : `${event.data}\n`);
  });

  // Notify on the OS drop event so the executor aborts an in-flight scan at once,
  // instead of waiting out the ~3s poll and then a multi-minute command timeout.
  const disconnectSub = RNBluetoothClassic.onDeviceDisconnected((event) => {
    if (event.device?.address !== device.address) return;
    connected = false;
    // Drop both listeners so reconnecting the same device can't stack stale ones.
    dataSub.remove();
    disconnectSub.remove();
    onStatus?.(false);
  });

  return {
    isConnected: () => connected,
    async send(data: string) {
      const ok = await device.write(data);
      if (!ok) {
        throw new Error("Failed to write to device");
      }
    },
    onDataReceived(callback: (data: string) => void) {
      onData = callback;
    },
    onStatusChanged(callback: (connected: boolean, error?: Error) => void) {
      onStatus = callback;
    },
    async disconnect() {
      connected = false;
      dataSub.remove();
      disconnectSub.remove();
      await device.disconnect();
    },
  };
}
