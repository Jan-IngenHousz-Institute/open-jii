import { connectToBteDevice } from "~/services/bluetooth-ble/connect-to-bte-device";
import { DisposableMultispeqCommandExecutor } from "~/services/multispeq-communication/disposable-multispeq-command-executor";
import { MultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { MultispeqMeasurementWidget } from "~/widgets/multispeq-measurement-widget";

interface BleConnectionScreenProps {
  route: {
    params: {
      deviceId: string;
    };
  };
}

export function BleConnectionScreen({ route }: BleConnectionScreenProps) {
  const { deviceId } = route.params;
  console.log("deviceId", deviceId);

  return (
    <MultispeqMeasurementWidget
      renderError={() => {
        return null;
      }}
      establishDeviceConnection={async () => {
        const createNewExecutor = async () => {
          const emitter = await connectToBteDevice(deviceId);
          return new MultispeqCommandExecutor(emitter);
        };

        const executor = new DisposableMultispeqCommandExecutor(
          createNewExecutor,
        );
        const response = await executor.execute("hello");
        if (
          typeof response !== "string" ||
          !response.toLowerCase().includes("ready")
        ) {
          throw new Error("Could not connect to Multispeq");
        }

        return executor;
      }}
    />
  );
}
