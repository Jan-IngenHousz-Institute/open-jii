import { MultiSpeqCommandExecutor } from "../services/multispeq-communication/multispeq-command-executor";
import { MultispeqMeasurementWidget } from "~/widgets/multispeq-measurement-widget";
import {
  openSerialPortConnection
} from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";

import {
  serialPortToMultispeqStream
} from "~/services/multispeq-communication/android-serial-port-connection/serial-port-to-multispeq-stream";
import {Image} from "react-native";
import multispeqMicroUsbImage from "../../assets/multispeq2-microusb.png";


export function SerialPortConnectionScreen() {
  return (
    <MultispeqMeasurementWidget
      renderError={error => {
        console.log('error.message', error.message)
        if (!error.message?.toLowerCase().includes('device not detected')) {
          return null
        }

        return <Image source={multispeqMicroUsbImage} resizeMode="contain" className="h-[250px] self-center"/>
      }}
      establishDeviceConnection={async () => {
        const serialPortEventsEmitter = await openSerialPortConnection();
        return new MultiSpeqCommandExecutor(serialPortToMultispeqStream(serialPortEventsEmitter));
      }}
    />
  );
}

