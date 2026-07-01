import { toast } from "sonner-native";
import { useConnectToDevice } from "~/features/connection/hooks/use-device-connection";
import { useTranslation } from "~/shared/i18n";
import type { Device } from "~/shared/types/device";

/** Wraps connect/disconnect with error toasts so the device sheet stays free of side-effect logic. */
export function useDeviceSheetActions() {
  const { t } = useTranslation("connection");
  const { connectToDevice, disconnectFromDevice, connectingDeviceId } = useConnectToDevice();

  const handleConnect = async (device: Device) => {
    try {
      await connectToDevice(device);
    } catch {
      toast.error(t("setup.errorConnect"));
    }
  };

  const handleDisconnect = async (device: Device) => {
    try {
      await disconnectFromDevice(device);
    } catch {
      toast.error(t("setup.errorDisconnect"));
    }
  };

  return { handleConnect, handleDisconnect, connectingDeviceId };
}
