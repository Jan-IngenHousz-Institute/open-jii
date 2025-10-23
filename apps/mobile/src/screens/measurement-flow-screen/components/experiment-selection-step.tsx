import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { ActivityIndicator } from "react-native";
import { Button } from "~/components/Button";
import { Dropdown } from "~/components/Dropdown";
import { useExperiments } from "~/hooks/use-experiments";
import { useTheme } from "~/hooks/use-theme";
import { useExperimentSelectionStore } from "~/stores/use-experiment-selection-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

interface ExperimentSelectionStepProps {
  onContinue?: (experimentId: string) => void;
}

export function ExperimentSelectionStep({ onContinue }: ExperimentSelectionStepProps) {
  const { classes } = useTheme();
  const { experiments, isLoading, error } = useExperiments();
  const { selectedExperimentId, setSelectedExperimentId } = useExperimentSelectionStore();

  const selectedExperiment = experiments.find((exp) => exp.value === selectedExperimentId);

  return (
    <View>
      {/* Header */}
      <View className="mb-8">
        <Text className={clsx("mb-2 text-center text-3xl font-bold", classes.text)}>
          Experiment Selection
        </Text>
        <Text className={clsx("text-center text-lg leading-6", classes.textSecondary)}>
          Choose an experiment to begin your measurement workflow
        </Text>
      </View>

      {/* Experiment Selection Card */}
      <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
        <Text className={clsx("mb-4 text-xl font-semibold", classes.text)}>
          Step 1: Select Experiment
        </Text>

        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#005e5e" />
            <Text className={clsx("mt-4 text-center", classes.textSecondary)}>
              Loading experiments...
            </Text>
          </View>
        ) : error ? (
          <View className="items-center py-8">
            <Text className={clsx("text-center text-red-500", classes.text)}>
              Failed to load experiments. Please try again.
            </Text>
          </View>
        ) : (
          <>
            <Dropdown
              label="Available Experiments"
              options={experiments}
              selectedValue={selectedExperimentId}
              onSelect={(value) => setSelectedExperimentId(value)}
              placeholder="Choose an experiment to continue"
            />

            {selectedExperiment?.description && (
              <View className="mt-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <Text className={clsx("text-sm", classes.textSecondary)}>
                  {selectedExperiment.description}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Action Button */}
      {selectedExperiment && (
        <View className="mt-8">
          <Button
            title="Start measurement flow"
            onPress={() => {
              if (selectedExperimentId && onContinue) {
                onContinue(selectedExperimentId);
              }
            }}
            style={{ width: "100%" }}
          />
        </View>
      )}
    </View>
  );
}
