import { useAsync, useAsyncCallback } from "react-async-hook";
import { View } from "react-native";

import { BigActionButton } from "../components/big-action-button";
import { ErrorView } from "../components/error-view";
import { LargeSpinner } from "../components/large-spinner";
import { ResultView } from "../components/result-view";
import { bluetoothDeviceToMultispeqStream } from "../services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { connectWithBluetoothDevice } from "../services/multispeq-communication/android-bluetooth-connection/connect-with-bluetooth-device";
import { MultiSpeqCommandExecutor } from "../services/multispeq-communication/multispeq-command-executor";
import { assertEnvVariables } from "~/utils/assert";
import { sendMqttEvent } from "~/services/mqtt/send-mqtt-event";
import { useToast } from "~/components/toast-provider";

const protocol = [{ spad: [1] }];
const { MQTT_TOPIC: topic } = assertEnvVariables({
  MQTT_TOPIC: process.env.MQTT_TOPIC,
})

export function BluetoothDeviceDetailsScreen({ route }: any) {
  const { deviceId } = route.params;

  const { showToast } = useToast()

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

  const {
    execute: handleScan,
    loading: isScanning,
    result: scanResult,
    error: measurementError,
    reset,
  } = useAsyncCallback(() => multispeq?.execute(protocol));

  const { execute: handleScanUpload, loading: isUploading, error: uploadError } = useAsyncCallback(async () => {
    if (typeof scanResult !== 'object') {
      return;
    }

    try {
      await sendMqttEvent(topic, scanResult)
      showToast('Measurement uploaded!')
    } catch (e: any) {
      showToast('Error. Please try again.', 'error')
    }

  })


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
      {uploadError && <ErrorView error={uploadError} />}
      <BigActionButton onPress={handleScan} text="Start Measurement" loading={isScanning} disabled={isScanning} />
      <BigActionButton onPress={handleScanUpload} text="Upload measurement" disabled={!scanResult || isUploading} loading={isUploading} />
    </View>
  );
}
