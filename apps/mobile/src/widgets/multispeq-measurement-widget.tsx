import { ReactNode } from "react";
import { useAsync, useAsyncCallback } from "react-async-hook";
import { View } from "react-native";
import { assertEnvVariables } from "~/utils/assert";
import { prettifyErrorMessages } from "~/utils/prettify-error-messages";

import { BigActionButton } from "../components/big-action-button";
import { ErrorView } from "../components/error-view";
import { LargeSpinner } from "../components/large-spinner";
import { ResultView } from "../components/result-view";
import { useToast } from "../components/toast-provider";
import { sendMqttEvent } from "../services/mqtt/send-mqtt-event";
import { IMultispeqCommandExecutor } from "../services/multispeq-communication/multispeq-command-executor";

const { MQTT_TOPIC: topic } = assertEnvVariables({
  MQTT_TOPIC: process.env.MQTT_TOPIC,
});

const protocol = [{ spad: [1] }];

interface Props {
  establishDeviceConnection: () => Promise<IMultispeqCommandExecutor>;
  renderError?: (error: Error) => ReactNode;
}

export function MultispeqMeasurementWidget({ establishDeviceConnection, renderError }: Props) {
  const { showToast } = useToast();

  const {
    result: multispeq,
    loading: isConnecting,
    error: connectionError,
    execute: reconnect,
  } = useAsync(async () => {
    try {
      await multispeq?.destroy();
    } catch {
      // ignored
    }
    return await establishDeviceConnection();
  }, []);

  const {
    execute: handleScan,
    loading: isScanning,
    result: scanResult,
    error: measurementError,
    reset,
  } = useAsyncCallback(async () => {
    try {
      return await multispeq?.execute(protocol);
    } catch (e) {
      console.log("Error executing command", e);
      throw Error("Scan failed, try reconnecting your PhotosynQ device.");
    }
  });

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

  const handleReconnect = async () => {
    reset();
    await reconnect();
  };
  const error = connectionError ?? measurementError;

  if (error || !multispeq) {
    return (
      <View className="w-full flex-1 justify-between bg-white p-4">
        <ErrorView error={prettifyErrorMessages(error ?? "Cannot connect")} />
        {error && renderError?.(error)}
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
