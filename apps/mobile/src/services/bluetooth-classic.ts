import RNBluetoothClassic, {
  BluetoothDevice,
} from "react-native-bluetooth-classic";

import { Emitter } from "../utils/emitter";
import { SerialPortEvents } from "./multispeq-communication/serial-port-events";
import { MultispeqStreamEvents } from "./multispeq-communication/serial-port-to-multispeq-stream";
import { requestBluetoothPermission } from "./request-bluetooth-permissions";

export async function getBluetoothClassicDevices() {
  await requestBluetoothPermission();
  try {
    await RNBluetoothClassic.cancelDiscovery();
  } catch (e) {
    // ignored
  }
  const devices = await RNBluetoothClassic.startDiscovery();
  return devices;
}

export async function connectWithBluetoothDevice(deviceAddress: string) {
  try {
    const bondedDevices = await RNBluetoothClassic.getBondedDevices();
    let device = bondedDevices.find((d) => d.address === deviceAddress);
    if (!device) {
      device = await RNBluetoothClassic.pairDevice(deviceAddress);
      console.log("paired with device", device.name);
    }
    if (!(await device.isConnected())) {
      console.log("device not connected, connecting...");
      await device.connect();
    }
    console.log("connected to device");
    return device;
  } catch (e) {
    console.log("error pairing", e);
    throw e;
  }
}

export function bluetoothDeviceToMultispeqStream(
  connectedDevice: BluetoothDevice,
) {
  const emitter = new Emitter<MultispeqStreamEvents>();

  connectedDevice.onDataReceived((event) => {
    console.log("eventType", event.eventType, typeof event.data);
    if (typeof event.data !== "string") {
      return;
    }

    console.log("onDataReceived");
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
    const command = typeof data === "string" ? data : JSON.stringify(data);
    console.log("sending command to device", command);
    connectedDevice.write(command);
    connectedDevice.write("\r\n");
  });

  return emitter;
}
