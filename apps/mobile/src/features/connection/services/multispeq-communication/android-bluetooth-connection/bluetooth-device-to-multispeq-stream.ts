import type { BluetoothDevice } from "react-native-bluetooth-classic";
import { Emitter } from "~/shared/utils/emitter";
import { createLogger } from "~/shared/utils/logger";
import { stringifyIfObject } from "~/shared/utils/stringify-if-object";

import type { MultispeqStreamEvents } from "../multispeq-stream-events";

const log = createLogger("bt-classic");

export function bluetoothDeviceToMultispeqStream(connectedDevice: BluetoothDevice) {
  const emitter = new Emitter<MultispeqStreamEvents>();

  connectedDevice.onDataReceived((event) => {
    if (typeof event.data !== "string") {
      log.debug("non-string event", { eventType: event.eventType, dataType: typeof event.data });
      return;
    }

    const checksum = event.data.slice(-8);
    const jsonData = event.data.slice(0, -8);
    try {
      emitter
        .emit("receivedReplyFromDevice", {
          data: JSON.parse(jsonData),
          checksum,
        })
        .catch((e) => log.warn("receivedReplyFromDevice emit failed", { err: (e as Error)?.message }));
    } catch {
      emitter
        .emit("receivedReplyFromDevice", {
          data: event.data,
          checksum: "",
        })
        .catch((e) => log.warn("receivedReplyFromDevice emit failed", { err: (e as Error)?.message }));
    }
  });

  emitter.on("sendCommandToDevice", async (data: string | object) => {
    const result = await connectedDevice.write(stringifyIfObject(data) + "\r\n");
    if (!result) {
      throw new Error("Failed to write to device");
    }
  });

  emitter.on("destroy", async () => {
    await connectedDevice.disconnect();
  });

  return emitter;
}
