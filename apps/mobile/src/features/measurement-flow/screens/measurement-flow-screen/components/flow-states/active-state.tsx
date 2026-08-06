import React from "react";
import { View, ScrollView } from "react-native";
import type { AddressedGateToken } from "~/features/measurement-flow/services/workbook-runner-ports";
import { FlowNode } from "~/shared/measurements/flow-node";

import { AnalysisNode } from "../flow-nodes/analysis-node/analysis-node";
import { CommandNode } from "../flow-nodes/command-node/command-node";
import { InstructionNode } from "../flow-nodes/instruction-node";
import { MeasurementNode } from "../flow-nodes/measurement-node/measurement-node";
import { ParallelContainerNode } from "../flow-nodes/parallel-container-node";
import { QuestionNode } from "../flow-nodes/question-node/question-node";

interface ActiveStateProps {
  currentNode: FlowNode;
  interaction?: AddressedGateToken;
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

function renderNode(currentNode: FlowNode, interaction?: AddressedGateToken) {
  switch (currentNode.type) {
    case "question":
      return <QuestionNode node={currentNode} />;
    case "analysis":
      return (
        <AnalysisNode
          content={currentNode.content}
          nodeId={currentNode.id}
          interaction={interaction}
        />
      );
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
      if (currentNode.content.command) {
        return (
          <CommandNode
            content={currentNode.content}
            nodeId={currentNode.id}
            trackId={interaction?.trackId}
          />
        );
      }
      return (
        <ScrollableNode>
          <MeasurementNode
            content={currentNode.content}
            nodeId={currentNode.id}
            trackId={interaction?.trackId}
          />
        </ScrollableNode>
      );
    default:
      return null;
  }
}

export function ActiveState({ currentNode, interaction }: ActiveStateProps) {
  // Each node controls its own navigation/actions; no shared footer here.
  return <View className="flex-1">{renderNode(currentNode, interaction)}</View>;
}
