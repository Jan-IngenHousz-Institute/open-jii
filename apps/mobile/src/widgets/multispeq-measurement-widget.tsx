import { useAsync, useAsyncCallback } from "react-async-hook";
import { View } from "react-native";

import { BigActionButton } from "../components/big-action-button";
import { ErrorView } from "../components/error-view";
import { LargeSpinner } from "../components/large-spinner";
import { ResultView } from "../components/result-view";

import { MultiSpeqCommandExecutor } from "../services/multispeq-communication/multispeq-command-executor";
import { sendMqttEvent } from "../services/mqtt/send-mqtt-event";
import { assertEnvVariables } from "~/utils/assert";
import { useToast } from "../components/toast-provider";

const { MQTT_TOPIC: topic } = assertEnvVariables({
  MQTT_TOPIC: process.env.MQTT_TOPIC,
});

const protocol = [{ spad: [1] }];

type Props = {
  establishDeviceConnection: () => Promise<MultiSpeqCommandExecutor>;
};

export function MultispeqMeasurementWidget({ establishDeviceConnection }: Props) {
  const { showToast } = useToast();

  const {
    result: multispeq,
    loading: isConnecting,
    error: connectionError,
    execute: reconnect,
  } = useAsync(establishDeviceConnection, []);

  const {
    execute: handleScan,
    loading: isScanning,
    result: scanResult,
    error: measurementError,
    reset,
  } = useAsyncCallback(() => multispeq?.execute(protocol));

  const {
    execute: handleScanUpload,
    loading: isUploading,
    error: uploadError,
  } = useAsyncCallback(async () => {
    if (typeof scanResult !== "object") return;

    try {
      await sendMqttEvent(topic, scanResult);
      showToast("Measurement uploaded!", "success");
    } catch (e: any) {
      console.log("Upload failed", e);
      showToast("Please check your internet connection and try again.", "error");
    }
  });

  if (isConnecting) {
    return <LargeSpinner>Connecting to device...</LargeSpinner>;
  }

  const error = connectionError ?? measurementError;

  if (error || !multispeq) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <ErrorView error={error ?? "Cannot connect"} />
        <BigActionButton onPress={reconnect} text="Connect" />
      </View>
    );
  }

  return (
    <View className="w-full flex-1 justify-between bg-white p-4">
      <View className="w-full flex-[2] items-center justify-center rounded-2xl border border-gray-300 bg-gray-50 p-4 shadow-md">
        <ResultView scanResult={scanResult} isScanning={isScanning} />
      </View>
      {uploadError && <ErrorView error={uploadError} />}
      <BigActionButton
        onPress={handleScan}
        text="Start Measurement"
        loading={isScanning}
        disabled={isScanning}
      />
      <BigActionButton
        onPress={handleScanUpload}
        text="Upload measurement"
        disabled={!scanResult || isUploading}
        loading={isUploading}
      />
    </View>
  );
}
