import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { MeasurementScreen } from "~/components/measurement/MeasurementScreen";
import { Toast } from "~/components/Toast";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";
import {
  useMeasurementState,
  useMeasurement,
  mockProtocols,
  mockExperiments,
} from "~/hooks/useMeasurement";

export default function MeasurementActiveScreen() {
  const theme = useTheme();
  
  const { selectedExperiment, connectedDevice, disconnectDevice } = useMeasurementState();
  const {
    measurementData,
    isMeasuring,
    isUploading,
    startMeasurement,
    uploadMeasurement,
    clearMeasurement,
  } = useMeasurement();

  const [selectedProtocol, setSelectedProtocol] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  // Redirect to setup if no device connected
  useEffect(() => {
    if (!connectedDevice) {
      router.replace("/setup");
    }
  }, [connectedDevice]);

  const handleStartMeasurement = async () => {
    if (!selectedExperiment || !selectedProtocol) {
      setToast({
        visible: true,
        message: "Please select an experiment and protocol",
        type: "warning",
      });
      return;
    }

    try {
      await startMeasurement(selectedExperiment, selectedProtocol);
      setToast({
        visible: true,
        message: "Measurement completed successfully",
        type: "success",
      });
    } catch {
      setToast({
        visible: true,
        message: "Measurement failed",
        type: "error",
      });
    }
  };

  const handleUploadMeasurement = async () => {
    try {
      await uploadMeasurement();
      setToast({
        visible: true,
        message: "Measurement uploaded successfully",
        type: "success",
      });
    } catch {
      setToast({
        visible: true,
        message: "Upload failed. Data saved locally.",
        type: "error",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectDevice();
      clearMeasurement();
      setToast({
        visible: true,
        message: "Disconnected from device",
        type: "info",
      });
      router.replace("/setup");
    } catch {
      setToast({
        visible: true,
        message: "Error disconnecting",
        type: "error",
      });
    }
  };

  const experimentName = selectedExperiment
    ? mockExperiments.find((e) => e.value === selectedExperiment)?.label
    : "No experiment selected";

  if (!connectedDevice) {
    return null; // Will redirect to setup
  }

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
        experimentName={experimentName}
        protocols={mockProtocols}
        selectedProtocol={selectedProtocol}
        onSelectProtocol={setSelectedProtocol}
        onStartMeasurement={handleStartMeasurement}
        onUploadMeasurement={handleUploadMeasurement}
        onDisconnect={handleDisconnect}
        isMeasuring={isMeasuring}
        isUploading={isUploading}
        isConnected={!!connectedDevice}
        measurementData={measurementData}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
