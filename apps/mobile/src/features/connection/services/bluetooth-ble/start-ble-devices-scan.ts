import type { BleError, Device } from "react-native-ble-plx";
import { ScanMode } from "react-native-ble-plx";
import { Emitter } from "~/features/connection/utils/emitter";
import { createLogger } from "~/shared/observability/logger";

import { requestBluetoothPermission } from "../request-bluetooth-permissions";
import { prepareBluetooth } from "./prepare-bluetooth";

const log = createLogger("bt-ble");

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
        emitter.emit("bluetoothError", error).catch((e) =>
          log.warn("bluetoothError emit failed", {
            err: e instanceof Error ? e.message : String(e),
          }),
        );
        return;
      }
      if (!device) {
        return;
      }
      emitter.emit("bluetoothDeviceFound", device).catch((e) =>
        log.warn("bluetoothDeviceFound emit failed", {
          err: e instanceof Error ? e.message : String(e),
        }),
      );
    },
  );

  return emitter;
}
