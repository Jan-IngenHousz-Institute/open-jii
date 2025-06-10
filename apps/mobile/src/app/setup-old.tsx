import { router } from "expo-router";
import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Toast } from "~/components/Toast";
import { ConnectionSetup } from "~/components/measurement/ConnectionSetup";
import { DeviceList } from "~/components/measurement/DeviceList";
import { colors } from "~/constants/colors";
import {
  useMeasurementState,
  useDeviceScan,
  mockExperiments,
} from "~/hooks/useMeasurement";
import { useTheme } from "~/hooks/useTheme";
import type { Device } from "~/types/measurement";

export default function SetupScreen() {
  const theme = useTheme();

  // Use custom hooks for state management
  const { selectedExperiment, setSelectedExperiment, connectToDevice } =
    useMeasurementState();

  const {
    devices: discoveredDevices,
    isScanning,
    startScan,
    clearError: clearScanError,
  } = useDeviceScan();

  const [selectedConnectionType, setSelectedConnectionType] = useState<
    "bluetooth" | "ble" | "usb" | null
  >(null);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  const handleSelectExperiment = async (value: string) => {
    try {
      await setSelectedExperiment(value);
      setToast({
        visible: true,
        message: "Experiment selected",
        type: "success",
      });
    } catch {
      setToast({
        visible: true,
        message: "Failed to select experiment",
        type: "error",
      });
    }
  };

  const handleSelectConnectionType = (type: "bluetooth" | "ble" | "usb") => {
    setSelectedConnectionType(type);
    setShowDeviceList(false);
    clearScanError();
  };

  const handleScanForDevices = async () => {
    if (!selectedConnectionType) {
      setToast({
        visible: true,
        message: "Please select a connection type first",
        type: "warning",
      });
      return;
    }

    try {
      setShowDeviceList(true);
      await startScan(selectedConnectionType);

      if (discoveredDevices.length > 0) {
        setToast({
          visible: true,
          message: `Found ${discoveredDevices.length} device(s)`,
          type: "success",
        });
      }
    } catch {
      setToast({
        visible: true,
        message: "Scan failed",
        type: "error",
      });
    }
  };

  const handleConnectToDevice = async (device: Device) => {
    try {
      await connectToDevice(device);
      setToast({
        visible: true,
        message: `Connected to ${device.name}`,
        type: "success",
      });

      // Navigate to measurement screen
      router.push("/measurement-active");
    } catch {
      setToast({
        visible: true,
        message: "Connection failed",
        type: "error",
      });
    }
  };

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ConnectionSetup
          selectedExperiment={selectedExperiment}
          selectedConnectionType={selectedConnectionType}
          mockExperiments={mockExperiments}
          onSelectExperiment={handleSelectExperiment}
          onSelectConnectionType={handleSelectConnectionType}
          onScanForDevices={handleScanForDevices}
          isScanning={isScanning}
        />

        {showDeviceList && (
          <DeviceList
            devices={discoveredDevices}
            isScanning={isScanning}
            onConnectToDevice={handleConnectToDevice}
          />
        )}
      </ScrollView>

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
  scrollContent: {
    flexGrow: 1,
  },
});
