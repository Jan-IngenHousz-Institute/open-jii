import { useAsync, useAsyncCallback } from "react-async-hook";
import { View } from "react-native";

import { BigActionButton } from "../components/big-action-button";
import { ErrorView } from "../components/error-view";
import { LargeSpinner } from "../components/large-spinner";
import { ResultView } from "../components/result-view";
import { bluetoothDeviceToMultispeqStream } from "../services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { connectWithBluetoothDevice } from "../services/multispeq-communication/android-bluetooth-connection/connect-with-bluetooth-device";
import { MultiSpeqCommandExecutor } from "../services/multispeq-communication/multispeq-command-executor";

const protocol = [{ spad: [1] }];

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

  const {
    execute: handleScan,
    loading: isScanning,
    result: scanResult,
    error: measurementError,
    reset,
  } = useAsyncCallback(() => multispeq?.execute(protocol));

  if (isConnecting) {
    return <LargeSpinner>Connecting to device...</LargeSpinner>;
  }

  const error = connectionError ?? measurementError;

  if (error || !multispeq) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-4">
        <ErrorView error={error ?? "Cannot connect"} />
        <BigActionButton onPress={handleReconnect} text="Reconnect" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-4 justify-between w-full">
      <View className="flex-[2] w-full justify-center items-center border border-gray-300 rounded-2xl p-4 bg-gray-50 shadow-md">
        <ResultView scanResult={scanResult} isScanning={isScanning} />
      </View>
      <BigActionButton onPress={handleScan} text="Start Measurement" />
    </View>
  );
}
