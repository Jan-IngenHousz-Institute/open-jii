import { clsx } from "clsx";
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { ActivityIndicator } from "react-native";
import { Button } from "~/components/Button";
import { Dropdown } from "~/components/Dropdown";
import { useExperimentFlowQuery } from "~/hooks/use-experiment-flow-query";
import { useExperiments } from "~/hooks/use-experiments";
import { useTheme } from "~/hooks/use-theme";
import { useExperimentSelectionStore } from "~/stores/use-experiment-selection-store";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { orderFlowNodes } from "~/utils/order-flow-nodes";

export function ExperimentSelectionStep() {
  const { classes } = useTheme();
  const { experiments, isLoading, error } = useExperiments();
  const { selectedExperimentId, setSelectedExperimentId } = useExperimentSelectionStore();
  const { setExperimentId, setFlowNodes, nextStep } = useMeasurementFlowStore();
  const { refetch: fetchExperimentFlow, isFetching } = useExperimentFlowQuery(selectedExperimentId);
  const { clearHistory } = useFlowAnswersStore();

  const selectedExperiment = experiments.find((exp) => exp.value === selectedExperimentId);

  return (
    <View className="flex-1">
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
      <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
        <View className="flex-1 p-6">
          <Text className={clsx("mb-4 text-xl font-semibold", classes.text)}>
            Step 1: Select Experiment
          </Text>

          {isLoading && (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#005e5e" />
              <Text className={clsx("mt-4 text-center", classes.textSecondary)}>
                Loading experiments...
              </Text>
            </View>
          )}

          {!isLoading && error && (
            <View className="items-center py-8">
              <Text className={clsx("text-center text-red-500", classes.text)}>
                Failed to load experiments. Please try again.
              </Text>
            </View>
          )}

          {!isLoading && !error && (
            <>
              <Dropdown
                label="Available Experiments"
                options={experiments}
                selectedValue={selectedExperimentId}
                onSelect={(value) => setSelectedExperimentId(value)}
                placeholder="Choose an experiment to continue"
              />

              {selectedExperiment?.fullDescription && (
                <View className="mt-4 flex-1 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <ScrollView className="flex-1">
                    <Text className={clsx("text-sm", classes.textSecondary)}>
                      {selectedExperiment.fullDescription}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>

        {/* Action Button footer inside card for consistent layout */}
        <View className="border-t border-gray-200 p-4 dark:border-gray-700">
          <Button
            title="Start measurement flow"
            onPress={async () => {
              if (!selectedExperimentId) {
                return;
              }

              // Clear previous answers when starting a new flow
              clearHistory();

              setExperimentId(selectedExperimentId);

              const experimentFlow = await fetchExperimentFlow();
              const { nodes = [], edges = [] } = experimentFlow?.data?.body?.graph ?? {};

              const orderedNodes = orderFlowNodes(nodes, edges);
              setFlowNodes(orderedNodes);
              nextStep();
            }}
            isDisabled={!selectedExperimentId || isFetching}
            style={{ width: "100%" }}
          />
        </View>
      </View>
    </View>
  );
}
