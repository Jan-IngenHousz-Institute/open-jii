import { Image } from "react-native";
import { bluetoothDeviceToMultispeqStream } from "~/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { connectWithBluetoothDevice } from "~/services/multispeq-communication/android-bluetooth-connection/connect-with-bluetooth-device";
import { MultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { MultispeqMeasurementWidget } from "~/widgets/multispeq-measurement-widget";

import multispeqButtonImage from "../../../assets/multispeq2-button.png";

interface BluetoothDeviceDetailsScreenProps {
  route: {
    params: {
      deviceId: string;
    };
  };
}

export function BluetoothDeviceDetailsScreen({ route }: BluetoothDeviceDetailsScreenProps) {
  const { deviceId } = route.params;

  return (
    <MultispeqMeasurementWidget
      renderError={(error) => {
        if (!error.message?.toLowerCase().includes("closed or timeout")) {
          return null;
        }
        return (
          <Image
            source={multispeqButtonImage}
            resizeMode="contain"
            className="h-[250px] self-center"
          />
        );
      }}
      establishDeviceConnection={async () => {
        const device = await connectWithBluetoothDevice(deviceId);
        return new MultispeqCommandExecutor(bluetoothDeviceToMultispeqStream(device));
      }}
    />
  );
}
