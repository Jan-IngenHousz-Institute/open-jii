import React from "react";
import { View, ScrollView } from "react-native";
import { FlowNode } from "~/shared/measurements/flow-node";

import { AnalysisNode } from "../flow-nodes/analysis-node/analysis-node";
import { InstructionNode } from "../flow-nodes/instruction-node";
import { MeasurementNode } from "../flow-nodes/measurement-node/measurement-node";
import { ParallelContainerNode } from "../flow-nodes/parallel-container-node";
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

function renderNode(currentNode: FlowNode) {
  switch (currentNode.type) {
    case "question":
      return <QuestionNode node={currentNode} />;
    case "analysis":
      return <AnalysisNode content={currentNode.content} nodeId={currentNode.id} />;
    case "branch":
      // Branches are transparent runner cells and never become host interactions.
      return null;
    case "parallel":
      return <ParallelContainerNode node={currentNode} />;
    case "instruction":
      return (
        <ScrollableNode>
          <InstructionNode content={currentNode.content} />
        </ScrollableNode>
      );
    case "measurement":
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
  // Each node controls its own navigation/actions; no shared footer here.
  return <View className="flex-1">{renderNode(currentNode)}</View>;
}
