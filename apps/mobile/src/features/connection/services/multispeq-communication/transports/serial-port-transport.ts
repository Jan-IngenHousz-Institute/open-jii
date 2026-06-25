import type { Emitter } from "~/features/connection/utils/emitter";

import type { ITransportAdapter } from "@repo/iot";

import type { SerialPortEvents } from "../android-serial-port-connection/serial-port-events";

/**
 * Wrap the existing USB-serial connection emitter as an `ITransportAdapter` so
 * it can drive the shared `@repo/iot` `MultispeqDriver`.
 *
 * The serial layer (`openSerialPortConnection`) already delivers raw, possibly
 * partial, `"\n"`-terminated chunks via `dataReceivedFromDevice`, which
 * `MultispeqDriver` buffers and frames. This replaces the old bespoke
 * `serialPortToMultispeqStream` framing (now handled by the driver).
 */
export function serialPortTransport(emitter: Emitter<SerialPortEvents>): ITransportAdapter {
  let onData: ((data: string) => void) | undefined;
  let onStatus: ((connected: boolean, error?: Error) => void) | undefined;
  let connected = true;

  emitter.on("dataReceivedFromDevice", (data) => onData?.(data));

  return {
    isConnected: () => connected,
    async send(data: string) {
      try {
        await emitter.emit("sendDataToDevice", data);
      } catch (err) {
        // A closed USB port throws "device not open" on write; treat it as a
        // drop so the in-flight command aborts instead of hanging.
        connected = false;
        onStatus?.(false);
        throw err;
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
      await emitter.emit("destroy");
    },
  };
}
