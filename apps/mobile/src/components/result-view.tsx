import { ActivityIndicator, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { JSONViewer } from "./json-viewer";

export function ResultView({ isScanning, scanResult }) {
  const { colors, isDark } = useTheme();
  if (isScanning) {
    return (
      <ActivityIndicator
        size="large"
        color={isDark ? colors.primary.bright : colors.primary.dark}
      />
    );
  }
  if (scanResult) {
    return <JSONViewer data={scanResult} />;
  }

  return <Text className="text-inactive text-center">Scan result will appear here</Text>;
}
