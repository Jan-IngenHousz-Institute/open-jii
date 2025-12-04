import React from "react";
import { View, ScrollView } from "react-native";

import { FlowNode } from "../../types";
import { AnalysisNode } from "../flow-nodes/analysis-node";
import { InstructionNode } from "../flow-nodes/instruction-node";
import { MeasurementNode } from "../flow-nodes/measurement-node/measurement-node";
import { QuestionNode } from "../flow-nodes/question-node";
import { FlowProgressIndicator } from "../flow-progress-indicator";

interface ActiveStateProps {
  currentNode: FlowNode;
}

export function ActiveState({ currentNode }: ActiveStateProps) {
  const isQuestionNode = currentNode.type === "question";

  return (
    <View style={{ flex: 1 }}>
      <FlowProgressIndicator />

      {isQuestionNode ? (
        <QuestionNode node={currentNode} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {currentNode.type === "instruction" && <InstructionNode content={currentNode.content} />}
          {currentNode.type === "measurement" && <MeasurementNode content={currentNode.content} />}
          {currentNode.type === "analysis" && <AnalysisNode content={currentNode.content} />}
        </ScrollView>
      )}

      {/* Footer removed: each node should control its own navigation/actions */}
    </View>
  );
}
