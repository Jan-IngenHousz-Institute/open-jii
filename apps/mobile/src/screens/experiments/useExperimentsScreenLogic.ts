import { useState } from "react";

export interface UseExperimentsScreenLogic {
  // State
  selectedExperiment: string | null;
  refreshing: boolean;
  isOffline: boolean;
  toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  };

  // Data
  mockExperiments: { label: string; value: string }[];
  mockMeasurements: Record<string, any[]>;

  // Actions
  handleSelectExperiment: (value: string) => void;
  onRefresh: () => Promise<void>;
  getMeasurementsForSelectedExperiment: () => any[];
  setToast: (toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }) => void;
}

// Mock data
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

const mockMeasurements: Record<string, any[]> = {
  leaf_photosynthesis: [
    {
      id: "lp1",
      timestamp: "2025-06-10 14:30:22",
      data: {
        phi2: 0.72,
        npq: 1.8,
        fv_fm: 0.83,
        sample_id: "leaf_sample_1",
        metadata: {
          temperature: 25.3,
          humidity: 65,
          light_intensity: 800,
        },
      },
    },
    {
      id: "lp2",
      timestamp: "2025-06-10 15:45:10",
      data: {
        phi2: 0.68,
        npq: 2.1,
        fv_fm: 0.81,
        sample_id: "leaf_sample_2",
        metadata: {
          temperature: 24.8,
          humidity: 62,
          light_intensity: 750,
        },
      },
    },
  ],
  chlorophyll_fluorescence: [
    {
      id: "cf1",
      timestamp: "2025-06-10 09:45:11",
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

export function useExperimentsScreenLogic(): UseExperimentsScreenLogic {
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  const handleSelectExperiment = (value: string) => {
    setSelectedExperiment(value);
    setToast({
      visible: true,
      message: `Selected ${mockExperiments.find((e) => e.value === value)?.label}`,
      type: "info",
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      // Simulate network request
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate network check
      const randomOffline = Math.random() > 0.8;
      setIsOffline(randomOffline);

      if (!randomOffline) {
        setToast({
          visible: true,
          message: "Experiments refreshed",
          type: "success",
        });
      } else {
        setToast({
          visible: true,
          message: "You are offline",
          type: "warning",
        });
      }
    } catch (error) {
      setToast({
        visible: true,
        message: "Failed to refresh experiments",
        type: "error",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getMeasurementsForSelectedExperiment = () => {
    if (!selectedExperiment) return [];
    return mockMeasurements[selectedExperiment] || [];
  };

  return {
    // State
    selectedExperiment,
    refreshing,
    isOffline,
    toast,

    // Data
    mockExperiments,
    mockMeasurements,

    // Actions
    handleSelectExperiment,
    onRefresh,
    getMeasurementsForSelectedExperiment,
    setToast,
  };
}
