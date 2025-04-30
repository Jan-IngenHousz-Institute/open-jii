import { Emitter } from "../../utils/emitter";
import { SerialPortEvents } from "./serial-port-events";

export type MultispeqStreamEvents = {
  sendCommandToDevice: string | object;
  receivedReplyFromDevice: { data: object | string; checksum: string };
  destroy: void;
};

function toHex(data: string) {
  const hexString = Array.from(data)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return hexString;
}

function hexToString(hex: string) {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }

  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const byte = hex.slice(i, i + 2);
    result += String.fromCharCode(parseInt(byte, 16));
  }

  return result;
}

export function serialPortToMultispeqStream(
  inputEmitter: Emitter<SerialPortEvents>,
) {
  const outputEmitter = new Emitter<MultispeqStreamEvents>();
  let bufferedData: string[] = [];

  inputEmitter.on("dataReceivedFromDevice", (data) => {
    bufferedData.push(data);
    if (!data.endsWith("0A")) {
      return;
    }

    const totalData = bufferedData.join("");
    const jsonData = hexToString(totalData.slice(0, -18));
    const checksum = totalData.slice(-18, -2);

    const jsonObject = JSON.parse(jsonData);
    bufferedData = [];
    outputEmitter.emit("receivedReplyFromDevice", {
      data: jsonObject,
      checksum,
    });
  });

  outputEmitter.on("sendCommandToDevice", (command) => {
    inputEmitter.emit("sendDataToDevice", toHex(JSON.stringify(command)));
    inputEmitter.emit("sendDataToDevice", toHex("\r\n"));
  });

  outputEmitter.on("destroy", () => inputEmitter.emit("destroy"));

  return outputEmitter;
}
