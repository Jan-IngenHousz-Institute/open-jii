import { toast } from "sonner-native";
import { useConnectToDevice } from "~/features/connection/hooks/use-device-connection";
import {
  mobileDeviceAttributedLabel,
  presentMobileDevice,
} from "~/features/connection/services/mobile-device-presentation";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import { useTranslation } from "~/shared/i18n";
import type { Device } from "~/shared/types/device";

/** Wraps connect/disconnect with error toasts so the device sheet stays free of side-effect logic. */
export function useDeviceSheetActions() {
  const { t } = useTranslation("connection");
  const { connectToDevice, disconnectFromDevice, connectingDeviceId } = useConnectToDevice();

  const capturedIdentity = (device: Device) =>
    useScannerCommandExecutorStore.getState().executors.get(device.id)?.identity;

  const errorLabel = (device: Device, identity = capturedIdentity(device)) => {
    return mobileDeviceAttributedLabel(presentMobileDevice(device, identity), {
      unknownDevice: t("identity.unknownDevice"),
      identifier: (id) => t("identity.identifier", { id }),
    });
  };

  const handleConnect = async (device: Device) => {
    const identity = capturedIdentity(device);
    try {
      await connectToDevice(device);
    } catch {
      toast.error(
        t("setup.errorConnect", {
          name: errorLabel(device, identity),
        }),
      );
    }
  };

  const handleDisconnect = async (device: Device) => {
    // The disconnect path removes its executor after transport teardown. Keep
    // the already-captured identity available if a later cleanup/query step fails.
    const identity = capturedIdentity(device);
    try {
      await disconnectFromDevice(device);
    } catch {
      toast.error(
        t("setup.errorDisconnect", {
          name: errorLabel(device, identity),
        }),
      );
    }
  };

  return { handleConnect, handleDisconnect, connectingDeviceId };
}
