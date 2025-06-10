import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Toast } from "~/components/Toast";
import { MeasurementScreen } from "~/components/measurement/MeasurementScreen";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

const mockProtocols = [
  {
    label: "Standard Protocol",
    value: "standard",
    description: "Basic measurement protocol",
  },
  {
    label: "Extended Protocol",
    value: "extended",
    description: "Detailed measurement with additional parameters",
  },
  {
    label: "Quick Scan",
    value: "quick",
    description: "Rapid measurement with minimal parameters",
  },
];

const mockExperiments = [
  {
    label: "Leaf Photosynthesis",
    value: "leaf_photosynthesis",
    description: "Measures photosynthetic activity in leaves",
  },
  {
    label: "Chlorophyll Fluorescence",
    value: "chlorophyll_fluorescence",
    description: "Analyzes chlorophyll fluorescence parameters",
  },
  {
    label: "Absorbance Spectrum",
    value: "absorbance_spectrum",
    description: "Measures light absorbance across wavelengths",
  },
];

export default function MeasurementActiveScreen() {
  const theme = useTheme();

  const [selectedProtocol, setSelectedProtocol] = useState<string | undefined>(
    undefined,
  );
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [measurementData, setMeasurementData] = useState<any>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(
    null,
  );
  const [connectedDevice, setConnectedDevice] = useState<any>(null);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  useEffect(() => {
    const loadConnectionInfo = async () => {
      try {
        const [storedExperiment, storedDevice] = await Promise.all([
          AsyncStorage.getItem("selected_experiment"),
          AsyncStorage.getItem("connected_device"),
        ]);

        if (storedExperiment) {
          setSelectedExperiment(storedExperiment);
        }

        if (storedDevice) {
          setConnectedDevice(JSON.parse(storedDevice));
        }
      } catch (error) {
        console.error("Error loading connection info:", error);
      }
    };

    loadConnectionInfo();
  }, []);

  const handleStartMeasurement = async () => {
    if (!selectedProtocol) {
      setToast({
        visible: true,
        message: "Please select a protocol first",
        type: "warning",
      });
      return;
    }

    setIsMeasuring(true);

    try {
      // Simulate measurement
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Mock measurement data
      const mockData = {
        timestamp: new Date().toISOString(),
        experiment: selectedExperiment,
        protocol: selectedProtocol,
        data: {
          fv_fm: 0.85,
          npq: 1.3,
          phi2: 0.68,
          sample_id: `sample_${Date.now()}`,
        },
      };

      setMeasurementData(mockData);

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
    } finally {
      setIsMeasuring(false);
    }
  };

  const handleUploadMeasurement = async () => {
    if (!measurementData) return;

    setIsUploading(true);

    try {
      // Simulate upload
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setToast({
        visible: true,
        message: "Measurement uploaded successfully",
        type: "success",
      });

      // Clear measurement data after successful upload
      setMeasurementData(null);
    } catch {
      setToast({
        visible: true,
        message: "Upload failed. Data saved locally.",
        type: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      // Clear stored connection info
      await AsyncStorage.removeItem("connected_device");

      setToast({
        visible: true,
        message: "Disconnected from device",
        type: "info",
      });

      // Navigate back to setup
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
