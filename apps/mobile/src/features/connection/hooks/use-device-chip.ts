import { useBatteryLevel } from "~/features/connection/hooks/use-battery-level";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import type { DeviceChipProps } from "~/shared/ui/widgets/device-chip";

// Wires the shared DeviceChip widget to connection state. Public surface:
// any feature's header can render <DeviceChip {...useDeviceChip()} />.
export function useDeviceChip(): DeviceChipProps {
  const { data: connectedDevice } = useConnectedDevice();
  const lastConnectedDevice = useDeviceConnectionStore((s) => s.lastConnectedDevice);
  const batteryLevel = useBatteryLevel();
  const openSheet = useDeviceSheetStore((s) => s.open);

  if (connectedDevice) {
    return {
      state: "connected",
      deviceName: connectedDevice.name,
      batteryLevel,
      onPress: openSheet,
    };
  }
  return { state: lastConnectedDevice ? "last-known" : "never", onPress: openSheet };
}
