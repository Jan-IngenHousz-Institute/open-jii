import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { MeasurementModal } from "./components/measurement-modal";
import { MeasurementPreview } from "./components/measurement-preview";

interface MeasurementResultProps {
  data: any;
  timestamp?: string;
  experimentName?: string;
}

export function MeasurementResult({ data, timestamp, experimentName }: MeasurementResultProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
          },
        ]}
      >
        <MeasurementPreview
          data={data}
          timestamp={timestamp}
          experimentName={experimentName}
          onExpand={() => setIsFullScreen(true)}
        />
      </View>

      <MeasurementModal
        visible={isFullScreen}
        data={data}
        timestamp={timestamp}
        experimentName={experimentName}
        onClose={() => setIsFullScreen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
});
