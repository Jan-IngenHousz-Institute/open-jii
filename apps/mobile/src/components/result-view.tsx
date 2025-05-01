import { ActivityIndicator, Text } from "react-native";

import { JSONViewer } from "./json-viewer";

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
