import { router } from "expo-router";
import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Toast } from "~/components/Toast";
import { MeasurementScreen } from "~/components/measurement/MeasurementScreen";
import { colors } from "~/constants/colors";
import { mockProtocols } from "~/hooks/useMeasurement";
import { useTheme } from "~/hooks/useTheme";

import { useMeasurementScreenLogic } from "./useMeasurementScreenLogic";

export function ActiveMeasurementScreen() {
  const theme = useTheme();
  const logic = useMeasurementScreenLogic();

  // Redirect to setup if no device connected
  useEffect(() => {
    if (!logic.connectedDevice) {
      router.replace("/setup");
    }
  }, [logic.connectedDevice]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark
            ? colors.dark.background
            : colors.light.background,
        },
      ]}
    >
      <MeasurementScreen
        experimentName={logic.experimentName}
        protocols={mockProtocols}
        selectedProtocol={logic.selectedProtocol}
        onSelectProtocol={logic.setSelectedProtocol}
        onStartMeasurement={logic.handleStartMeasurement}
        onUploadMeasurement={logic.handleUploadMeasurement}
        onDisconnect={logic.handleDisconnect}
        isMeasuring={logic.isMeasuring}
        isUploading={logic.isUploading}
        isConnected={!!logic.connectedDevice}
        measurementData={logic.measurementData}
      />

      <Toast
        visible={logic.toast.visible}
        message={logic.toast.message}
        type={logic.toast.type}
        onDismiss={() => logic.setToast({ ...logic.toast, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
