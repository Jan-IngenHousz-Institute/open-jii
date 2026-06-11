import { Parity, UsbSerialManager } from "react-native-usb-serialport-for-android";
import { delay } from "~/features/connection/utils/delay";
import { Emitter } from "~/features/connection/utils/emitter";
import { createLogger } from "~/shared/observability/logger";

import type { SerialPortEvents } from "./serial-port-events";

const log = createLogger("serial-port");

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

async function waitForPermission(deviceId: number) {
  while (true) {
    if (await UsbSerialManager.hasPermission(deviceId)) {
      return;
    }
    if (await UsbSerialManager.tryRequestPermission(deviceId)) {
      return;
    }
    await delay(2000);
  }
}

// Android shows one USB permission dialog at a time; a tryRequestPermission
// issued while another device's dialog is up auto-denies, and the retry loop
// then spams dialogs. Serialize permission acquisition across devices.
let permissionGate: Promise<void> = Promise.resolve();

export async function openSerialPortConnection(deviceId: number) {
  const acquired = permissionGate.then(() => waitForPermission(deviceId));
  permissionGate = acquired.catch(() => undefined);
  await acquired;

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
      .catch((e) => log.warn("dataReceivedFromDevice emit failed", { err: (e as Error)?.message }));
  });

  emitter.on("sendDataToDevice", async (data) => {
    await usbSerialPort.send(toHex(data));
  });

  return emitter;
}
