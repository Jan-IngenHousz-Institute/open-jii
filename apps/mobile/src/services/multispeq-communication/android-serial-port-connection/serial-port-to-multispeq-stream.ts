import { Emitter } from "../../../utils/emitter";
import { stringifyIfObject } from "../../../utils/stringify-if-object";
import { MultispeqStreamEvents } from "../multispeq-stream-events";
import { SerialPortEvents } from "./serial-port-events";

export function serialPortToMultispeqStream(
  inputEmitter: Emitter<SerialPortEvents>,
) {
  const outputEmitter = new Emitter<MultispeqStreamEvents>();
  let bufferedData: string[] = [];

  inputEmitter.on("dataReceivedFromDevice", async (data) => {
    bufferedData.push(data);
    if (!data.endsWith("\n")) {
      return;
    }

    const totalData = bufferedData.join("");
    bufferedData = [];

    const jsonData = totalData.slice(0, -9);
    const checksum = totalData.slice(-9, -1);

    try {
      await outputEmitter.emit("receivedReplyFromDevice", {
        data: JSON.parse(jsonData),
        checksum,
      });
    } catch {
      await outputEmitter.emit("receivedReplyFromDevice", {
        data: totalData.slice(0, -1), // skip the newline
        checksum,
      });
    }
  });

  outputEmitter.on("sendCommandToDevice", async (command: object | string) => {
    await inputEmitter.emit(
      "sendDataToDevice",
      stringifyIfObject(command) + "\r\n",
    );
  });

  outputEmitter.on("destroy", () => inputEmitter.emit("destroy"));

  return outputEmitter;
}
