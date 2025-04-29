import { useEffect, useState } from "react";
import { useAsync } from "react-async-hook";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { JSONViewer } from "../components/json-viewer";
import { LargeSpinner } from "../components/large-spinner";
import { openSerialPortConnection } from "../services/multispeq-communication/open-serial-port-connection";
import { toMultispeqStream } from "../services/multispeq-communication/to-multispeq-stream";

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

export function SerialPortTestPage() {
  const [scanResult, setResult] = useState<object>();
  const [isScanning, setIsScanning] = useState(false);

  const {
    result: multispeqStream,
    loading,
    error,
  } = useAsync(async () => {
    const multispeqStream = toMultispeqStream(await openSerialPortConnection());
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

      {/* Start Button */}
      <TouchableOpacity
        onPress={handleScan}
        className="w-full bg-blue-600 rounded-full py-6 mt-6 items-center shadow-lg active:opacity-80"
      >
        <Text className="text-white text-2xl font-bold">Start Scan</Text>
      </TouchableOpacity>
    </View>
  );
}
