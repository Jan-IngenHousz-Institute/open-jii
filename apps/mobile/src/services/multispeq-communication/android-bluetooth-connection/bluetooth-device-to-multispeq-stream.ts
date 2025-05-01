import { BluetoothDevice } from "react-native-bluetooth-classic";

import { Emitter } from "../../../utils/emitter";
import { stringifyIfObject } from "../../../utils/stringify-if-object";
import { MultispeqStreamEvents } from "../multispeq-stream-events";

export function bluetoothDeviceToMultispeqStream(
  connectedDevice: BluetoothDevice,
) {
  const emitter = new Emitter<MultispeqStreamEvents>();

  connectedDevice.onDataReceived((event) => {
    console.log("eventType", event.eventType, typeof event.data);
    if (typeof event.data !== "string") {
      return;
    }

    const checksum = event.data.slice(-8);
    const jsonData = event.data.slice(0, -8);
    try {
      emitter.emit("receivedReplyFromDevice", {
        data: JSON.parse(jsonData),
        checksum,
      });
    } catch {
      emitter.emit("receivedReplyFromDevice", {
        data: event.data,
        checksum: "",
      });
    }
  });

  emitter.on("sendCommandToDevice", (data: string | object) => {
    connectedDevice.write(stringifyIfObject(data) + "\r\n");
  });

  return emitter;
}
