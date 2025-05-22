import { BleManager } from 'react-native-ble-plx';
import {useAsync} from "react-async-hook";
import multispeqMicroUsbImage from "../../assets/multispeq2-microusb.png";
import {
  openSerialPortConnection
} from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import {MultiSpeqCommandExecutor} from "~/services/multispeq-communication/multispeq-command-executor";
import {
  serialPortToMultispeqStream
} from "~/services/multispeq-communication/android-serial-port-connection/serial-port-to-multispeq-stream";
import {MultispeqMeasurementWidget} from "~/widgets/multispeq-measurement-widget";
import {MultispeqStreamEvents} from "~/services/multispeq-communication/multispeq-stream-events";
import {Emitter} from "~/utils/emitter";
import {stringifyIfObject} from "~/utils/stringify-if-object";
import {bleManager} from "~/services/bluetooth-ble/prepare-bluetooth";

const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef1';
const WRITE_UUID = 'abcdef01-1234-5678-9abc-def012345679';
const NOTIFY_UUID = 'abcdef02-1234-5678-9abc-def012345679';


interface BleConnectionScreenProps {
  route: {
    params: {
      deviceId: string;
    };
  };
}


export function BleConnectionScreen({ route }: BleConnectionScreenProps) {
  const { deviceId } = route.params
  console.log('deviceId', deviceId)

  return <MultispeqMeasurementWidget
    renderError={() => {
      return null;
    }}
    establishDeviceConnection={async () => {
      const emitter = new Emitter<MultispeqStreamEvents>();
      const device = await bleManager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();

      emitter.on('sendCommandToDevice', async (command: string | object) => {
        const stringData = stringifyIfObject(command);
        const base64Data = btoa(stringData);
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          WRITE_UUID,
          base64Data
        );
      })

      const values: string[] = []
      const characteristicSubscription = device.monitorCharacteristicForService(
        SERVICE_UUID,
        NOTIFY_UUID,
        (error, characteristic) => {
          console.log('got response!', characteristic);
          if (error || !characteristic?.value) {
            console.error('Notification error:', error ?? 'no value');
            return;
          }

          const value = atob(characteristic.value)
          values.push(value);
          if (!value.endsWith('__EOM__')) {
            return;
          }
          const trimmed = values.join('').slice(0, -15);
          try {
            emitter.emit('receivedReplyFromDevice', ({ data: JSON.parse(trimmed), checksum: ''}))
          } catch {
            emitter.emit('receivedReplyFromDevice', ({ data: trimmed, checksum: '' }))
          }
        }
      );

      return new MultiSpeqCommandExecutor(emitter)
    }}
  />

  return null;
}