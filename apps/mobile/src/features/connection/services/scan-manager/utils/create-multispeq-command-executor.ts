import { createCommandExecutor } from "~/features/connection/services/device-connection-manager/device-connection";
import { Device } from "~/shared/types/device";

export async function createMultispeqCommandExecutor(device: Device | undefined) {
  if (!device) {
    return undefined;
  }
  return createCommandExecutor(device);
}
