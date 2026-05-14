import React from "react";
import { View, ScrollView } from "react-native";

import { FlowNode } from "../../types";
import { AnalysisNode } from "../flow-nodes/analysis-node/analysis-node";
import { InstructionNode } from "../flow-nodes/instruction-node";
import { MeasurementNode } from "../flow-nodes/measurement-node/measurement-node";
import { QuestionNode } from "../flow-nodes/question-node/question-node";

interface ActiveStateProps {
  currentNode: FlowNode;
}

export function ActiveState({ currentNode }: ActiveStateProps) {
  const isQuestionNode = currentNode.type === "question";
  const isAnalysisNode = currentNode.type === "analysis";

  return (
    <View className="flex-1">
      {isQuestionNode ? (
        <QuestionNode node={currentNode} />
      ) : isAnalysisNode ? (
        <AnalysisNode content={currentNode.content} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {currentNode.type === "instruction" && <InstructionNode content={currentNode.content} />}
          {currentNode.type === "measurement" && <MeasurementNode content={currentNode.content} />}
        </ScrollView>
      )}

      {/* Footer removed: each node should control its own navigation/actions */}
    </View>
  );
}
