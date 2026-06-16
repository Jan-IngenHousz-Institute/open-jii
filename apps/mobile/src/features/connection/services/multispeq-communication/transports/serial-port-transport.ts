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

  emitter.on("dataReceivedFromDevice", (data) => onData?.(data));

  return {
    isConnected: () => true,
    async send(data: string) {
      await emitter.emit("sendDataToDevice", data);
    },
    onDataReceived(callback: (data: string) => void) {
      onData = callback;
    },
    onStatusChanged() {
      // No status channel on the serial emitter.
    },
    async disconnect() {
      await emitter.emit("destroy");
    },
  };
}
