import { useBatteryLevel } from "~/features/connection/hooks/use-battery-level";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useReconnectDevice } from "~/features/connection/hooks/use-reconnect-device";
import {
  mobileDevicePrimaryLabel,
  presentMobileDevice,
} from "~/features/connection/services/mobile-device-presentation";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import { useTranslation } from "~/shared/i18n";
import type { DeviceChipProps } from "~/shared/ui/widgets/device-chip";

// Wires the shared DeviceChip widget to connection state. Public surface:
// any feature's header can render <DeviceChip {...useDeviceChip()} />.
export function useDeviceChip(): DeviceChipProps {
  const { t } = useTranslation("connection");
  const { data: connectedDevice } = useConnectedDevice();
  const lastConnectedDevice = useReconnectDevice();
  const batteryLevel = useBatteryLevel();
  const openSheet = useDeviceSheetStore((s) => s.open);
  const identity = useScannerCommandExecutorStore((s) =>
    connectedDevice ? s.executors.get(connectedDevice.id)?.identity : undefined,
  );

  if (connectedDevice) {
    const presentation = presentMobileDevice(connectedDevice, identity);
    return {
      state: "connected",
      deviceName: mobileDevicePrimaryLabel(presentation, t("identity.unknownDevice")),
      batteryLevel,
      onPress: openSheet,
    };
  }
  return { state: lastConnectedDevice ? "last-known" : "never", onPress: openSheet };
}
