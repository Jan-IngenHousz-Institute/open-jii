import { clsx } from "clsx";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Button } from "~/components/Button";
import { useExperimentFlow } from "~/hooks/use-experiment-flow";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { AnalysisNode } from "./flow-nodes/analysis-node";
import { InstructionNode } from "./flow-nodes/instruction-node";
import { MeasurementNode } from "./flow-nodes/measurement-node";
import { QuestionNode } from "./flow-nodes/question-node";

export function CustomMeasurementFlowStep() {
  const { classes } = useTheme();
  const { experimentId, flowNodes, currentFlowStep, isFlowCompleted, setFlowNodes, nextFlowStep } =
    useMeasurementFlowStore();

  const { data: { body } = {}, isLoading, error } = useExperimentFlow(experimentId);

  const initializeFlow = () => {
    if (body?.graph?.nodes && body.graph.nodes.length > 0) {
      setFlowNodes(body.graph.nodes);
    }
  };

  const isFlowInitialized = flowNodes.length > 0;

  if (isLoading) {
    return (
      <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#005e5e" />
          <Text className={clsx("mt-4 text-center", classes.textSecondary)}>
            Loading experiment flow...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
        <Text className={clsx("text-center text-red-500", classes.text)}>
          Failed to load experiment flow. Please try again.
        </Text>
      </View>
    );
  }

  if (!isFlowInitialized && body?.graph?.nodes) {
    return (
      <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
        <Text className={clsx("mb-4 text-center text-xl font-semibold", classes.text)}>
          Ready to Start Flow
        </Text>
        <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
          Your experiment flow is ready. Click the button below to begin the measurement process.
        </Text>
        <Button title="Start Flow" onPress={initializeFlow} style={{ width: "100%" }} />
      </View>
    );
  }

  if (isFlowCompleted) {
    return (
      <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
        <Text className={clsx("mb-4 text-center text-xl font-semibold", classes.text)}>
          🎉 Flow Completed!
        </Text>
        <Text className={clsx("text-center", classes.textSecondary)}>
          You have successfully completed the measurement flow.
        </Text>
      </View>
    );
  }

  const currentNode = flowNodes[currentFlowStep];

  if (!currentNode) {
    return (
      <View className={clsx("rounded-xl border p-6", classes.card, classes.border)}>
        <Text className={clsx("text-center", classes.textSecondary)}>No flow steps available.</Text>
      </View>
    );
  }

  return (
    <View>
      {currentNode.type === "instruction" && <InstructionNode content={currentNode.content} />}
      {currentNode.type === "question" && <QuestionNode content={currentNode.content} />}
      {currentNode.type === "measurement" && <MeasurementNode content={currentNode.content} />}
      {currentNode.type === "analysis" && <AnalysisNode content={currentNode.content} />}

      <View className="mt-6 items-center">
        {currentFlowStep < flowNodes.length - 1 && (
          <Button title="Next" onPress={nextFlowStep} style={{ width: "100%" }} />
        )}
      </View>
    </View>
  );
}
