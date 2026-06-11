import type { BluetoothDevice } from "react-native-bluetooth-classic";
import { Emitter } from "~/features/connection/utils/emitter";
import { stringifyIfObject } from "~/features/connection/utils/stringify-if-object";
import { createLogger } from "~/shared/observability/logger";

import { parseMultispeqFrame } from "../frame-parser";
import type { MultispeqStreamEvents } from "../multispeq-stream-events";

const log = createLogger("bt-classic");

export function bluetoothDeviceToMultispeqStream(connectedDevice: BluetoothDevice) {
  const emitter = new Emitter<MultispeqStreamEvents>();

  connectedDevice.onDataReceived((event) => {
    if (typeof event.data !== "string") {
      log.debug("non-string event", { eventType: event.eventType, dataType: typeof event.data });
      return;
    }

    emitter
      .emit("receivedReplyFromDevice", parseMultispeqFrame(event.data))
      .catch((e) =>
        log.warn("receivedReplyFromDevice emit failed", { err: (e as Error)?.message }),
      );
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
