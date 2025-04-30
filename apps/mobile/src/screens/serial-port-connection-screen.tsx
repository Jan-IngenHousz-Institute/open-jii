import { useEffect, useState } from "react";
import { useAsync } from "react-async-hook";
import { ActivityIndicator, Text, View } from "react-native";

import { BigActionButton } from "../components/big-action-button";
import { JSONViewer } from "../components/json-viewer";
import { LargeSpinner } from "../components/large-spinner";
import { openSerialPortConnection } from "../services/multispeq-communication/open-serial-port-connection";
import { serialPortToMultispeqStream } from "../services/multispeq-communication/serial-port-to-multispeq-stream";

const protocol = [{ spad: [1] }];

export function ResultView({ isScanning, scanResult }) {
  if (isScanning) {
    return <ActivityIndicator size="large" color="#2563eb" />;
  }
  if (scanResult) {
    return <JSONViewer data={scanResult} />;
  }

  return (
    <Text className="text-center text-gray-400">
      Scan result will appear here
    </Text>
  );
}

export function SerialPortConnectionScreen() {
  const [scanResult, setResult] = useState<object>();
  const [isScanning, setIsScanning] = useState(false);

  const {
    result: multispeqStream,
    loading,
    error,
  } = useAsync(async () => {
    const multispeqStream = serialPortToMultispeqStream(
      await openSerialPortConnection(),
    );
    multispeqStream.on("receivedReplyFromDevice", ({ data }) => {
      setIsScanning(false);
      setResult(data);
    });

    return multispeqStream;
  }, []);

  useEffect(() => {
    return () => multispeqStream?.emit("destroy");
  }, [multispeqStream]);

  if (loading && !error) {
    return <LargeSpinner>Connecting...</LargeSpinner>;
  }

  function handleScan() {
    setIsScanning(true);
    multispeqStream?.emit("sendCommandToDevice", protocol);
  }

  return (
    <View className="flex-1 bg-white p-4 justify-between w-full">
      <View className="flex-[2] w-full justify-center items-center border border-gray-300 rounded-2xl p-4 bg-gray-50 shadow-md">
        <ResultView scanResult={scanResult} isScanning={isScanning} />
      </View>
      <BigActionButton onPress={handleScan} text="Start Scan" />
    </View>
  );
}
