import {
  Parity,
  UsbSerialManager,
} from "react-native-usb-serialport-for-android";

import { delay } from "../../utils/delay";
import { Emitter } from "../../utils/emitter";
import { SerialPortEvents } from "./serial-port-events";

export async function openSerialPortConnection() {
  const [device] = await UsbSerialManager.list();
  if (!device) {
    throw new Error("device not found");
  }
  const { deviceId } = device;
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
    emitter.emit("dataReceivedFromDevice", event.data);
  });
  emitter.on("sendDataToDevice", async (data) => {
    try {
      console.log(
        "sent data to usb port",
        data,
        await usbSerialPort.send(data),
      );
    } catch (e) {
      console.log("error sending to device", e);
    }
  });

  console.log("got usb serial port", usbSerialPort);

  return emitter;
}
