import { Parity, UsbSerialManager } from "react-native-usb-serialport-for-android";

import { delay } from "../../../utils/delay";
import { Emitter } from "../../../utils/emitter";
import type { SerialPortEvents } from "./serial-port-events";

export function toHex(data: string) {
  const hexString = Array.from(data)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return hexString;
}

export function hexToString(hex: string) {
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

export async function listSerialPortDevices() {
  return await UsbSerialManager.list();
}

export async function openSerialPortConnection(deviceId: number) {
  while (true) {
    if (await UsbSerialManager.hasPermission(deviceId)) {
      break;
    }
    if (await UsbSerialManager.tryRequestPermission(deviceId)) {
      break;
    }
    await delay(2000);
  }

  const usbSerialPort = await UsbSerialManager.open(deviceId, {
    baudRate: 115200,
    dataBits: 8,
    parity: Parity.None,
    stopBits: 1,
  });

  const emitter = new Emitter<SerialPortEvents>();
  emitter.on("destroy", () => usbSerialPort.close());

  usbSerialPort.onReceived((event) => {
    emitter
      .emit("dataReceivedFromDevice", hexToString(event.data))
      .catch((e) => console.log("dataReceivedFromDevice", e));
  });

  emitter.on("sendDataToDevice", async (data) => {
    await usbSerialPort.send(toHex(data));
  });

  console.log("got usb serial port", usbSerialPort);

  return emitter;
}
