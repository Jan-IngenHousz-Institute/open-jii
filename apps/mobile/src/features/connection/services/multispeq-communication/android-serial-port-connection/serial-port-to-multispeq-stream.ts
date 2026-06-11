import { Emitter } from "~/features/connection/utils/emitter";
import { stringifyIfObject } from "~/features/connection/utils/stringify-if-object";

import { parseMultispeqFrame } from "../frame-parser";
import type { MultispeqStreamEvents } from "../multispeq-stream-events";
import type { SerialPortEvents } from "./serial-port-events";

export function serialPortToMultispeqStream(inputEmitter: Emitter<SerialPortEvents>) {
  const outputEmitter = new Emitter<MultispeqStreamEvents>();
  let bufferedData: string[] = [];

  inputEmitter.on("dataReceivedFromDevice", async (data) => {
    bufferedData.push(data);
    if (!data.endsWith("\n")) {
      return;
    }

    const totalData = bufferedData.join("");
    bufferedData = [];

    await outputEmitter.emit("receivedReplyFromDevice", parseMultispeqFrame(totalData));
  });

  outputEmitter.on("sendCommandToDevice", async (command: object | string) => {
    await inputEmitter.emit("sendDataToDevice", stringifyIfObject(command) + "\r\n");
  });

  outputEmitter.on("destroy", () => inputEmitter.emit("destroy"));

  return outputEmitter;
}
