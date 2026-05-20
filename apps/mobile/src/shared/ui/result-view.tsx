import { ActivityIndicator, Text } from "react-native";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { JSONViewer } from "./json-viewer";

export function ResultView({ isScanning, scanResult }) {
  const { colors } = useTheme();
  if (isScanning) {
    return <ActivityIndicator size="large" color={colors.brand} />;
  }
  if (scanResult) {
    return <JSONViewer data={scanResult} />;
  }

  return <Text className="text-inactive text-center">Scan result will appear here</Text>;
}
