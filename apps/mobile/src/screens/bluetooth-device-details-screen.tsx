import { bluetoothDeviceToMultispeqStream } from "~/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { connectWithBluetoothDevice } from "~/services/multispeq-communication/android-bluetooth-connection/connect-with-bluetooth-device";
import { MultiSpeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { MultispeqMeasurementWidget } from "~/widgets/multispeq-measurement-widget";


interface BluetoothDeviceDetailsScreenProps {
  route: {
    params: {
      deviceId: string;
    };
  };
};

export function BluetoothDeviceDetailsScreen({ route }: BluetoothDeviceDetailsScreenProps) {
  const { deviceId } = route.params;

  return (
    <MultispeqMeasurementWidget
      establishDeviceConnection={async () => {
        const device = await connectWithBluetoothDevice(deviceId);
        return new MultiSpeqCommandExecutor(
          bluetoothDeviceToMultispeqStream(device)
        );
      }}
    />
  );
}
