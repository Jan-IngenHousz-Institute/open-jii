import { useAsync, useAsyncCallback } from "react-async-hook";
import { View } from "react-native";

import { BigActionButton } from "../components/big-action-button";
import { ErrorView } from "../components/error-view";
import { LargeSpinner } from "../components/large-spinner";
import { ResultView } from "../components/result-view";
import { bluetoothDeviceToMultispeqStream } from "../services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { connectWithBluetoothDevice } from "../services/multispeq-communication/android-bluetooth-connection/connect-with-bluetooth-device";
import { MultiSpeqCommandExecutor } from "../services/multispeq-communication/multispeq-command-executor";
import { createMqttConnection } from "~/services/mqtt/mqtt";
import { assertEnvVariables } from "~/utils/assert";

const protocol = [{ spad: [1] }];
const { MQTT_TOPIC: topic } = assertEnvVariables({
  MQTT_TOPIC: process.env.MQTT_TOPIC
})

export function BluetoothDeviceDetailsScreen({ route }: any) {
  const { deviceId } = route.params;

  const {
    result: multispeq,
    loading: isConnecting,
    execute: handleReconnect,
    error: connectionError,
  } = useAsync(async () => {
    reset();
    const device = await connectWithBluetoothDevice(deviceId);
    return new MultiSpeqCommandExecutor(
      bluetoothDeviceToMultispeqStream(device),
    );
  }, [deviceId]);

  const { result: mqttEmitter, execute: reconnectToMqtt } =
    useAsync(() => createMqttConnection(), [])

  const {
    execute: handleScan,
    loading: isScanning,
    result: scanResult,
    error: measurementError,
    reset,
  } = useAsyncCallback(() => multispeq?.execute(protocol));

  async function handleScanUpload() {
    const payload = JSON.stringify(scanResult)

    if (!mqttEmitter) {
      alert('MQTT connection not established')
      return;
    }

    try {
      await mqttEmitter.emit('sendMessage', { payload, topic })
      alert('Measurement uploaded!')
      return;
    } catch (e: any) {
      console.log('mqtt error', e)
      console.log('reconnecting', e.message)
    }

    await reconnectToMqtt()
    try {
      await mqttEmitter.emit('sendMessage', { payload, topic })
      alert('Measurement uploaded!')
    } catch (e: any) {
      console.log('mqtt error', e)
      alert('Error ' + (e.message ?? 'unknown'))
    }
  }


  if (isConnecting) {
    return <LargeSpinner>Connecting to device...</LargeSpinner>;
  }

  const error = connectionError ?? measurementError;

  if (error || !multispeq) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <ErrorView error={error ?? "Cannot connect"} />
        <BigActionButton onPress={handleReconnect} text="Connect" />
      </View>
    );
  }

  return (
    <View className="w-full flex-1 justify-between bg-white p-4">
      <View className="w-full flex-[2] items-center justify-center rounded-2xl border border-gray-300 bg-gray-50 p-4 shadow-md">
        <ResultView scanResult={scanResult} isScanning={isScanning} />
      </View>
      <BigActionButton onPress={handleScan} text="Start Measurement" />
      <BigActionButton onPress={handleScanUpload} text="Upload measurement" disabled={!scanResult || !mqttEmitter}/>
    </View>
  );
}
