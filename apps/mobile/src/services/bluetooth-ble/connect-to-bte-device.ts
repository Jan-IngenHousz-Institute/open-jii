import { bleManager } from "~/services/bluetooth-ble/prepare-bluetooth";
import { MultispeqStreamEvents } from "~/services/multispeq-communication/multispeq-stream-events";
import { delay } from "~/utils/delay";
import { Emitter } from "~/utils/emitter";
import { safeAsync } from "~/utils/safe-async";
import { stringifyIfObject } from "~/utils/stringify-if-object";

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef1";
const WRITE_UUID = "abcdef01-1234-5678-9abc-def012345679";
const NOTIFY_UUID = "abcdef02-1234-5678-9abc-def012345679";

export async function connectToBteDevice(deviceId: string) {
  const emitter = new Emitter<MultispeqStreamEvents>();
  const device = await bleManager.connectToDevice(deviceId, { timeout: 10000 });
  await device.discoverAllServicesAndCharacteristics();

  emitter.on("sendCommandToDevice", async (command: string | object) => {
    const stringData = stringifyIfObject(command);
    const base64Data = btoa(stringData);
    await device.writeCharacteristicWithResponseForService(SERVICE_UUID, WRITE_UUID, base64Data);
  });

  const values: string[] = [];
  const characteristicSubscription = device.monitorCharacteristicForService(
    SERVICE_UUID,
    NOTIFY_UUID,
    safeAsync(async (error, characteristic) => {
      if (error || !characteristic?.value) {
        return;
      }

      const value = atob(characteristic.value);
      values.push(value);
      if (!value.endsWith("__EOM__")) {
        return;
      }
      const trimmed = values.join("").slice(0, -15);
      await delay(300);
      characteristicSubscription.remove();
      device.cancelConnection().catch(console.error);
      console.log("got response", trimmed);
      try {
        await emitter.emit("receivedReplyFromDevice", {
          data: JSON.parse(trimmed),
          checksum: "",
        });
      } catch {
        await emitter.emit("receivedReplyFromDevice", {
          data: values.join("").slice(0, -7),
          checksum: "",
        });
      }
    }),
  );

  return emitter;
}
