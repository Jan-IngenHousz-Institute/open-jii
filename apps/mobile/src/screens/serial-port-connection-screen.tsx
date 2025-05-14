import { useAsync, useAsyncCallback } from "react-async-hook";
import { View } from "react-native";

import { BigActionButton } from "../components/big-action-button";
import { ErrorView } from "../components/error-view";
import { LargeSpinner } from "../components/large-spinner";
import { ResultView } from "../components/result-view";
import { openSerialPortConnection } from "../services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import { serialPortToMultispeqStream } from "../services/multispeq-communication/android-serial-port-connection/serial-port-to-multispeq-stream";
import { MultiSpeqCommandExecutor } from "../services/multispeq-communication/multispeq-command-executor";

const protocol = [{ spad: [1] }];

export function SerialPortConnectionScreen() {
  const {
    result: multispeq,
    loading: isConnecting,
    error: connectionError,
    execute: handleReconnect,
  } = useAsync(async () => {
    reset();
    return new MultiSpeqCommandExecutor(
      serialPortToMultispeqStream(await openSerialPortConnection()),
    );
  }, []);

  const {
    execute: handleScan,
    loading: isScanning,
    result: scanResult,
    error: measurementError,
    reset,
  } = useAsyncCallback(() => multispeq?.execute(protocol), {
    onError: () => {
      multispeq
        ?.destroy()
        .catch((e) => console.log("multispeq connection destroy failed", e));
    },
  });

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
    </View>
  );
}
