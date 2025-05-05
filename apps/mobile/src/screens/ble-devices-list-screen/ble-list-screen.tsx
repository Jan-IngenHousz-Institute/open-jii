import { useState } from "react";
import { useAsync } from "react-async-hook";

import { ErrorView } from "../../components/error-view";
import { startDeviceScan } from "../../services/bluetooth-ble/start-ble-devices-scan";
import { DevicesListView } from "./components/item-card/components/devices-list-view";
import type { BluetoothDevice } from "./utils/bluetooth-device";
import { orderDevices } from "./utils/order-devices";
import { serializeDevice } from "./utils/serialize-device";
import { updateList } from "./utils/update-list";

export function BleListScreen() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);

  const { error } = useAsync(async () => {
    const emitter = await startDeviceScan();

    emitter.on("bluetoothDeviceFound", (newDevice) => {
      setDevices((devices) =>
        orderDevices(updateList(devices, serializeDevice(newDevice))),
      );
    });

    emitter.on("bluetoothError", (e) => alert(e.message));

    return () => emitter.emit("destroy");
  }, []);

  if (error) {
    return <ErrorView error={error} />;
  }

  return <DevicesListView items={devices} onRefresh={() => setDevices([])} />;
}
