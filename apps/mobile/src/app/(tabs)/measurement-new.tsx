import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Play, Settings, History } from "lucide-react-native";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Card } from "~/components/Card";
import { Toast } from "~/components/Toast";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

const mockExperiments = [
  {
    label: "Leaf Photosynthesis",
    value: "leaf_photosynthesis",
  },
  {
    label: "Chlorophyll Fluorescence",
    value: "chlorophyll_fluorescence",
  },
  {
    label: "Absorbance Spectrum",
    value: "absorbance_spectrum",
  },
];

export default function MeasurementScreen() {
  const theme = useTheme();

  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  // Load connection status and selected experiment
  useEffect(() => {
    const loadStatus = async () => {
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
        console.error("Error loading status:", error);
      }
    };

    loadStatus();
  }, []);

  const handleStartNewMeasurement = () => {
    if (connectedDevice) {
      router.push("/measurement-active");
    } else {
      router.push("/setup");
    }
  };

  const handleSetupDevice = () => {
    router.push("/setup");
  };

  const handleViewHistory = () => {
    router.push("/(tabs)/experiments");
  };

  const selectedExperimentLabel = selectedExperiment
    ? mockExperiments.find((e) => e.value === selectedExperiment)?.label
    : null;

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
      <View style={styles.content}>
        {/* Status Section */}
        <View style={styles.statusSection}>
          <Text
            style={[
              styles.title,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
            ]}
          >
            Measurement Center
          </Text>

          {/* Experiment Status */}
          <Card style={styles.statusCard}>
            <Text
              style={[
                styles.statusLabel,
                {
                  color: theme.isDark
                    ? colors.dark.inactive
                    : colors.light.inactive,
                },
              ]}
            >
              Active Experiment
            </Text>
            <Text
              style={[
                styles.statusValue,
                {
                  color: theme.isDark
                    ? colors.dark.onSurface
                    : colors.light.onSurface,
                },
              ]}
            >
              {selectedExperimentLabel || "No experiment selected"}
            </Text>
          </Card>

          {/* Device Status */}
          <Card style={styles.statusCard}>
            <Text
              style={[
                styles.statusLabel,
                {
                  color: theme.isDark
                    ? colors.dark.inactive
                    : colors.light.inactive,
                },
              ]}
            >
              Device Status
            </Text>
            <Text
              style={[
                styles.statusValue,
                {
                  color: connectedDevice
                    ? colors.semantic.success
                    : theme.isDark
                      ? colors.dark.onSurface
                      : colors.light.onSurface,
                },
              ]}
            >
              {connectedDevice ? `Connected to ${connectedDevice.name}` : "Not connected"}
            </Text>
          </Card>
        </View>

        {/* Action Cards */}
        <View style={styles.actionsSection}>
          {/* Start Measurement */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              styles.primaryActionCard,
              {
                backgroundColor: colors.primary.dark,
              },
            ]}
            onPress={handleStartNewMeasurement}
          >
            <Play size={32} color="white" />
            <Text style={styles.primaryActionTitle}>
              {connectedDevice ? "Start Measurement" : "Setup & Measure"}
            </Text>
            <Text style={styles.primaryActionSubtitle}>
              {connectedDevice 
                ? "Begin a new measurement session"
                : "Connect device and start measuring"
              }
            </Text>
          </TouchableOpacity>

          {/* Device Setup */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: theme.isDark
                  ? colors.dark.card
                  : colors.light.card,
              },
            ]}
            onPress={handleSetupDevice}
          >
            <Settings
              size={24}
              color={
                theme.isDark ? colors.dark.onSurface : colors.light.onSurface
              }
            />
            <Text
              style={[
                styles.actionTitle,
                {
                  color: theme.isDark
                    ? colors.dark.onSurface
                    : colors.light.onSurface,
                },
              ]}
            >
              Device Setup
            </Text>
            <Text
              style={[
                styles.actionSubtitle,
                {
                  color: theme.isDark
                    ? colors.dark.inactive
                    : colors.light.inactive,
                },
              ]}
            >
              Configure devices and experiments
            </Text>
          </TouchableOpacity>

          {/* Measurement History */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: theme.isDark
                  ? colors.dark.card
                  : colors.light.card,
              },
            ]}
            onPress={handleViewHistory}
          >
            <History
              size={24}
              color={
                theme.isDark ? colors.dark.onSurface : colors.light.onSurface
              }
            />
            <Text
              style={[
                styles.actionTitle,
                {
                  color: theme.isDark
                    ? colors.dark.onSurface
                    : colors.light.onSurface,
                },
              ]}
            >
              Measurement History
            </Text>
            <Text
              style={[
                styles.actionSubtitle,
                {
                  color: theme.isDark
                    ? colors.dark.inactive
                    : colors.light.inactive,
                },
              ]}
            >
              View previous measurements
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
  content: {
    flex: 1,
    padding: 16,
  },
  statusSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  statusCard: {
    marginBottom: 16,
    padding: 16,
  },
  statusLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionsSection: {
    flex: 1,
    gap: 16,
  },
  actionCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 120,
    justifyContent: "center",
  },
  primaryActionCard: {
    minHeight: 140,
  },
  primaryActionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginTop: 12,
    marginBottom: 4,
    textAlign: "center",
  },
  primaryActionSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  actionSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
});
