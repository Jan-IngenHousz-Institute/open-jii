import { MultiSpeqCommandExecutor } from "../services/multispeq-communication/multispeq-command-executor";
import { MultispeqMeasurementWidget } from "~/widgets/multispeq-measurement-widget";
import {
  openSerialPortConnection
} from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import {
  serialPortToMultispeqStream
} from "~/services/multispeq-communication/android-serial-port-connection/serial-port-to-multispeq-stream";



export function SerialPortConnectionScreen() {
  return (
    <MultispeqMeasurementWidget
      establishDeviceConnection={async () => {
        const serialPortEventsEmitter = await openSerialPortConnection();
        return new MultiSpeqCommandExecutor(serialPortToMultispeqStream(serialPortEventsEmitter));
      }}
    />
  );
}

