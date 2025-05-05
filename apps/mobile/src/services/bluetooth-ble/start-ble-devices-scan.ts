import type { BleError, Device} from "react-native-ble-plx";
import { ScanMode } from "react-native-ble-plx";

import { Emitter } from "../../utils/emitter";
import { requestBluetoothPermission } from "../request-bluetooth-permissions";
import { prepareBluetooth } from "./prepare-bluetooth";

export async function startDeviceScan() {
  const permissionsGranted = await requestBluetoothPermission();
  if (!permissionsGranted) {
    throw new Error("Bluetooth permissions not granted");
  }

  const bleManager = await prepareBluetooth();

  const emitter = new Emitter<{
    bluetoothDeviceFound: Device;
    bluetoothError: BleError;
    destroy: void;
  }>();

  emitter.on("destroy", () => bleManager.destroy());

  await bleManager.startDeviceScan(
    null,
    { scanMode: ScanMode.LowPower, allowDuplicates: true },
    (error, device) => {
      if (error) {
        emitter.emit("bluetoothError", error);
        return;
      }
      if (!device) {
        return;
      }
      emitter.emit("bluetoothDeviceFound", device);
    },
  );

  return emitter;
}
