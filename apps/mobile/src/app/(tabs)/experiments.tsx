import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Dropdown } from "~/components/Dropdown";
import { MeasurementResult } from "~/components/MeasurementResult";
import { OfflineBanner } from "~/components/OfflineBanner";
import { Toast } from "~/components/Toast";
import { useTheme } from "~/hooks/useTheme";

// Mock data - replace with actual data from your state management
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

const mockMeasurements = {
  leaf_photosynthesis: [
    {
      id: "lp1",
      timestamp: "2025-06-06 14:30:22",
      data: {
        photosynthetic_rate: 12.5,
        stomatal_conductance: 0.15,
        transpiration_rate: 2.3,
        sample_id: "leaf_sample_1",
        metadata: {
          temperature: 25.2,
          humidity: 65,
          light_intensity: 1200,
        },
      },
    },
    {
      id: "lp2",
      timestamp: "2025-06-05 11:15:43",
      data: {
        photosynthetic_rate: 10.8,
        stomatal_conductance: 0.12,
        transpiration_rate: 1.9,
        sample_id: "leaf_sample_2",
        metadata: {
          temperature: 23.8,
          humidity: 70,
          light_intensity: 1050,
        },
      },
    },
  ],
  chlorophyll_fluorescence: [
    {
      id: "cf1",
      timestamp: "2025-06-06 09:45:11",
      data: {
        fv_fm: 0.83,
        npq: 1.2,
        phi2: 0.72,
        sample_id: "leaf_sample_3",
        metadata: {
          dark_adaptation_time: 20,
          temperature: 24.5,
        },
      },
    },
  ],
  absorbance_spectrum: [],
};

export default function ExperimentsScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(
    null,
  );
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  useEffect(() => {
    // Load the selected experiment from storage
    const loadSelectedExperiment = async () => {
      try {
        const storedExperiment = await AsyncStorage.getItem(
          "selected_experiment",
        );
        if (storedExperiment) {
          setSelectedExperiment(storedExperiment);
        }
      } catch (error) {
        console.error("Error loading selected experiment:", error);
      }
    };

    // Simulate checking network status
    const randomOffline = Math.random() > 0.7;
    setIsOffline(randomOffline);

    if (randomOffline) {
      setToast({
        visible: true,
        message: "You are offline. Showing cached experiments.",
        type: "warning",
      });
    }

    loadSelectedExperiment();
  }, []);

  // Simulate refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);

    // Simulate network check
    const randomOffline = Math.random() > 0.7;
    setIsOffline(randomOffline);

    if (!randomOffline) {
      setToast({
        visible: true,
        message: "Experiments refreshed",
        type: "success",
      });
    }
  };

  const handleSelectExperiment = async (value: string) => {
    setSelectedExperiment(value);

    // Store the selected experiment in AsyncStorage
    try {
      await AsyncStorage.setItem("selected_experiment", value);
    } catch (error) {
      console.error("Error storing selected experiment:", error);
    }

    setToast({
      visible: true,
      message: `Selected experiment: ${mockExperiments.find((e) => e.value === value)?.label}`,
      type: "success",
    });
  };

  const getMeasurementsForSelectedExperiment = () => {
    if (!selectedExperiment) return [];
    return (
      mockMeasurements[selectedExperiment as keyof typeof mockMeasurements] ||
      []
    );
  };

  const renderMeasurementItem = ({ item }: { item: any }) => {
    return (
      <MeasurementResult
        data={item.data}
        timestamp={item.timestamp}
        experimentName={
          mockExperiments.find((e) => e.value === selectedExperiment)?.label
        }
      />
    );
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
      <OfflineBanner visible={isOffline} />

      <View style={styles.dropdownContainer}>
        <Dropdown
          label="Select Experiment"
          options={mockExperiments}
          selectedValue={selectedExperiment ?? undefined}
          onSelect={handleSelectExperiment}
          placeholder="Choose an experiment"
        />
      </View>

      {selectedExperiment ? (
        <View style={styles.measurementsContainer}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
            ]}
          >
            Previous Measurements
          </Text>

          <FlatList
            data={getMeasurementsForSelectedExperiment()}
            keyExtractor={(item) => item.id}
            renderItem={renderMeasurementItem}
            contentContainerStyle={styles.measurementsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary.dark}
                colors={[colors.primary.dark]}
              />
            }
            ListEmptyComponent={
              <Text
                style={[
                  styles.emptyText,
                  {
                    color: theme.isDark
                      ? colors.dark.inactive
                      : colors.light.inactive,
                  },
                ]}
              >
                No measurements found for this experiment
              </Text>
            }
          />
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <Text
            style={[
              styles.placeholderText,
              {
                color: theme.isDark
                  ? colors.dark.inactive
                  : colors.light.inactive,
              },
            ]}
          >
            Select an experiment to view measurements
          </Text>
        </View>
      )}

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
    padding: 16,
  },
  dropdownContainer: {
    marginBottom: 24,
  },
  measurementsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  measurementsList: {
    flexGrow: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    padding: 24,
  },
});
