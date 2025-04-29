import { useAsync } from "react-async-hook";
import {
  Codes,
  Parity,
  UsbSerialManager,
} from "react-native-usb-serialport-for-android";

const protocol = [{ spad: [1] }];

function toHex(data: object | string) {
  const hexString = Array.from(
    typeof data === "string" ? data : JSON.stringify(data),
  )
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  console.log("hexString", hexString);
  return hexString;
}

export function SerialPortTestPage() {
  useAsync(async () => {
    try {
      const [device] = await UsbSerialManager.list();
      console.log("device", device);
      if (!device) {
        throw new Error("device not found");
      }
      const deviceId = device.deviceId;
      await UsbSerialManager.tryRequestPermission(deviceId);
      const usbSerialport = await UsbSerialManager.open(deviceId, {
        baudRate: 115200,
        dataBits: 8,
        parity: Parity.None,
        stopBits: 1,
      });

      const sub = usbSerialport.onReceived((event) => {
        console.log("got event!", event);
      });
      console.log("usbSerialport", usbSerialport);
      console.log("sub", sub);
      // unsubscribe
      // sub.remove();

      const result = await usbSerialport.send(toHex(protocol));
      console.log("send package result", result);

      const result2 = await usbSerialport.send(toHex("\r\n"));
      console.log("send package result", result2);

      usbSerialport.close();
    } catch (err: any) {
      console.log("error", err, err.message, err.code, err.name);
      // console.log("error", JSON.stringify(err, null, 2));
      if (err.code === Codes.DEVICE_NOT_FOND) {
        // ...
      }
    }
  }, []);
  return null;
}
