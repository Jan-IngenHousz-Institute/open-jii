import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

export default function useExperiment() {
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSelectedExperiment();
  }, []);

  const loadSelectedExperiment = async () => {
    try {
      setIsLoading(true);
      const experiment = await AsyncStorage.getItem("selected_experiment");
      setSelectedExperiment(experiment);
    } catch (error) {
      console.error("Error loading selected experiment:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectExperiment = async (experimentId: string) => {
    try {
      await AsyncStorage.setItem("selected_experiment", experimentId);
      setSelectedExperiment(experimentId);
      return true;
    } catch (error) {
      console.error("Error selecting experiment:", error);
      return false;
    }
  };

  const clearSelectedExperiment = async () => {
    try {
      await AsyncStorage.removeItem("selected_experiment");
      setSelectedExperiment(null);
      return true;
    } catch (error) {
      console.error("Error clearing selected experiment:", error);
      return false;
    }
  };

  return {
    selectedExperiment,
    isLoading,
    selectExperiment,
    clearSelectedExperiment,
  };
}
