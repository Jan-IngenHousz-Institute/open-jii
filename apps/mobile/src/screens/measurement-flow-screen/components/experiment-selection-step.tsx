import { clsx } from "clsx";
import { FileText } from "lucide-react-native";
import React, { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Button } from "~/components/Button";
import { Dropdown } from "~/components/Dropdown";
import { HtmlViewer } from "~/components/HtmlViewer";
import { useExperimentFlowQuery } from "~/hooks/use-experiment-flow-query";
import { useExperiments } from "~/hooks/use-experiments";
import { usePrecachedExperimentData } from "~/hooks/use-precached-experiment-data";
import { useTheme } from "~/hooks/use-theme";
import { useExperimentSelectionStore } from "~/stores/use-experiment-selection-store";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { orderFlowNodes } from "~/utils/order-flow-nodes";

import { OfflineModeIndicator } from "./offline-mode-indicator";

export function ExperimentSelectionStep() {
  const { classes, colors } = useTheme();
  const { experiments, isLoading, error } = useExperiments();
  const { selectedExperimentId, setSelectedExperimentId } = useExperimentSelectionStore();
  const { setExperimentId, setFlowNodes } = useMeasurementFlowStore();
  const { data: experimentFlow } = useExperimentFlowQuery(selectedExperimentId);
  const { clearHistory } = useFlowAnswersStore();

  const selectedExperiment = experiments.find((exp) => exp.value === selectedExperimentId);

  const { data: precachedData } = usePrecachedExperimentData(selectedExperimentId);

  // Load flow nodes when experiment flow data is available
  useEffect(() => {
    if (experimentFlow?.body?.graph) {
      const { nodes = [], edges = [] } = experimentFlow.body.graph;
      const orderedNodes = orderFlowNodes(nodes, edges);
      setFlowNodes(orderedNodes);
    }
  }, [experimentFlow, setFlowNodes]);

  const handleStartFlow = () => {
    if (!selectedExperimentId || !experimentFlow) {
      return;
    }

    clearHistory();
    setExperimentId(selectedExperimentId);
  };

  return (
    <View className={clsx("flex-1")}>
      <View className="flex-1 px-4 pt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className={clsx("text-lg font-bold", classes.text)}>Select experiment</Text>
          <OfflineModeIndicator isVisible={!!precachedData} />
        </View>

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
              options={experiments}
              selectedValue={selectedExperimentId}
              onSelect={(value) => setSelectedExperimentId(value)}
              placeholder="Choose an experiment"
            />

            {selectedExperimentId && (
              <View className="flex-1 gap-2">
                <Text className={clsx("font-bold", classes.text)}>Description</Text>

                {selectedExperiment?.fullDescription ? (
                  <View className="flex-1">
                    <HtmlViewer htmlContent={selectedExperiment.fullDescription} />
                  </View>
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <>
                      <View
                        className={clsx(
                          "mb-4 h-14 w-14 items-center justify-center rounded-full",
                          classes.surface,
                        )}
                      >
                        <FileText size={26} color={colors.onSurface} />
                      </View>

                      <Text
                        className={clsx("text-center text-base font-medium", classes.textSecondary)}
                      >
                        No description available
                      </Text>
                    </>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </View>

      <View className="px-4 py-3">
        <Button
          title="Start flow"
          onPress={handleStartFlow}
          isDisabled={!selectedExperimentId || !experimentFlow}
          style={{ height: 44 }}
        />
      </View>
    </View>
  );
}
