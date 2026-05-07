import _ from "lodash";
import RNBluetoothClassic from "react-native-bluetooth-classic";

import { requestBluetoothPermission } from "../../request-bluetooth-permissions";
import { probeIsMultispeq } from "./probe-is-multispeq";

export async function getBluetoothClassicDevices() {
  await requestBluetoothPermission();
  try {
    await RNBluetoothClassic.cancelDiscovery();
  } catch {
    // ignored
  }
  const [bondedDevices, connectedDevices, visibleDevices] = await Promise.all([
    RNBluetoothClassic.getBondedDevices(),
    RNBluetoothClassic.getConnectedDevices(),
    RNBluetoothClassic.startDiscovery(),
  ]);

  const candidates = _.uniqBy([...bondedDevices, ...connectedDevices, ...visibleDevices], "id");

  // Identify MultispeQ devices by probing rather than by name, so units with
  // numeric or otherwise non-standard Bluetooth labels are still detected.
  const probed = await Promise.all(
    candidates.map(async (device) => ({ device, isMultispeq: await probeIsMultispeq(device) })),
  );
  return probed.filter(({ isMultispeq }) => isMultispeq).map(({ device }) => device);
}
