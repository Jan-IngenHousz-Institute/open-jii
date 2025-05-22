import { BleManager } from "react-native-ble-plx";

export const bleManager = new BleManager();

export function prepareBluetooth() {
  return new Promise<BleManager>((resolve, reject) => {
    const subscription = bleManager.onStateChange((state) => {
      if (state === "PoweredOn") {
        subscription.remove();
        resolve(bleManager);
        return;
      }
      if (["Unauthorized", "PoweredOff", "Unsupported"].includes(state)) {
        subscription.remove();
        reject(new Error(state));
        return;
      }
    }, true);
  });
}
