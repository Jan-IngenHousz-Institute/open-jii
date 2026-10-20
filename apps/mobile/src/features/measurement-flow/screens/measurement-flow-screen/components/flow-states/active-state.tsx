import React from "react";
import { View, ScrollView } from "react-native";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { FlowNode } from "~/shared/measurements/flow-node";

import { AnalysisNode } from "../flow-nodes/analysis-node/analysis-node";
import { BranchNode } from "../flow-nodes/branch-node/branch-node";
import { CommandNode } from "../flow-nodes/command-node/command-node";
import { InstructionNode } from "../flow-nodes/instruction-node";
import { MeasurementNode } from "../flow-nodes/measurement-node/measurement-node";
import { useExampleLayout, useIsPlotStepShowing } from "../flow-nodes/plot-node/next-plot";
import { PlotStep } from "../flow-nodes/plot-node/plot-step";
import { QuestionNode } from "../flow-nodes/question-node/question-node";

interface ActiveStateProps {
  currentNode: FlowNode;
}

const ScrollableNode = ({ children }: { children: React.ReactNode }) => (
  <ScrollView
    style={{ flex: 1 }}
    contentContainerStyle={{ flexGrow: 1 }}
    showsVerticalScrollIndicator={true}
    keyboardShouldPersistTaps="handled"
  >
    {children}
  </ScrollView>
);

function renderNode(currentNode: FlowNode, isDispatchTarget: boolean) {
  switch (currentNode.type) {
    case "question":
      return <QuestionNode node={currentNode} />;
    case "analysis":
      // One instance per step: what a step accepted, its comment and its dialogs belong to it.
      return (
        <AnalysisNode key={currentNode.id} content={currentNode.content} nodeId={currentNode.id} />
      );
    case "branch":
      return <BranchNode node={currentNode} />;
    case "instruction":
      return (
        <ScrollableNode>
          <InstructionNode content={currentNode.content} />
        </ScrollableNode>
      );
    case "measurement":
      // A measurement node carries either a protocol reference or an inline
      // device command; the latter runs through the lightweight CommandNode,
      // except as a dispatch target, where the multi-device MeasurementNode
      // runs each device's own payload.
      if (currentNode.content?.command && !isDispatchTarget) {
        return <CommandNode content={currentNode.content.command} nodeId={currentNode.id} />;
      }
      return (
        <ScrollableNode>
          <MeasurementNode content={currentNode.content} nodeId={currentNode.id} />
        </ScrollableNode>
      );
    default:
      return null;
  }
}

export function ActiveState({ currentNode }: ActiveStateProps) {
  const isDispatchTarget = useMeasurementFlowStore(
    (s) => s.devicePlan?.some((p) => p.targetCellId === currentNode.id) ?? false,
  );
  const exampleLayout = useExampleLayout();
  const isPlotStepShowing = useIsPlotStepShowing();

  if (isPlotStepShowing && exampleLayout) {
    return (
      <View className="flex-1">
        <PlotStep layout={exampleLayout} />
      </View>
    );
  }

  // Each node controls its own navigation/actions; no shared footer here.
  return <View className="flex-1">{renderNode(currentNode, isDispatchTarget)}</View>;
}
