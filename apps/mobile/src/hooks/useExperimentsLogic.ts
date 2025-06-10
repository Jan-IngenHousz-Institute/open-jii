import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

// Mock data - in a real app this would come from API/store
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

export function useExperimentsLogic() {
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(
    null,
  );
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load selected experiment from storage on mount
  useEffect(() => {
    loadSelectedExperiment();
  }, []);

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

  const handleSelectExperiment = async (value: string) => {
    setSelectedExperiment(value);
    try {
      await AsyncStorage.setItem("selected_experiment", value);
    } catch (error) {
      console.error("Error saving selected experiment:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      // Simulate network request
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate random network status
      const randomOffline = Math.random() > 0.8;
      setIsOffline(randomOffline);
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const getMeasurementsForSelectedExperiment = () => {
    if (!selectedExperiment) return [];
    return (
      mockMeasurements[selectedExperiment as keyof typeof mockMeasurements] ||
      []
    );
  };

  return {
    // State
    selectedExperiment,
    isOffline,
    refreshing,

    // Data
    mockExperiments,

    // Actions
    handleSelectExperiment,
    onRefresh,
    getMeasurementsForSelectedExperiment,
  };
}
