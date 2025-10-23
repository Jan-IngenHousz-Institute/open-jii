import React from "react";
import { View } from "react-native";
import { Button } from "~/components/Button";

import { AnalysisNode } from "../flow-nodes/analysis-node";
import { InstructionNode } from "../flow-nodes/instruction-node";
import { MeasurementNode } from "../flow-nodes/measurement-node";
import { QuestionNode } from "../flow-nodes/question-node";

interface ActiveStateProps {
  currentNode: {
    type: "instruction" | "question" | "measurement" | "analysis";
    content: any;
  };
  currentFlowStep: number;
  flowNodesLength: number;
  onNext: () => void;
}

export function ActiveState({
  currentNode,
  currentFlowStep,
  flowNodesLength,
  onNext,
}: ActiveStateProps) {
  return (
    <View>
      {currentNode.type === "instruction" && <InstructionNode content={currentNode.content} />}
      {currentNode.type === "question" && <QuestionNode content={currentNode.content} />}
      {currentNode.type === "measurement" && <MeasurementNode content={currentNode.content} />}
      {currentNode.type === "analysis" && <AnalysisNode content={currentNode.content} />}

      <View className="mt-6 items-center">
        {currentFlowStep < flowNodesLength - 1 ? (
          <Button title="Next" onPress={onNext} style={{ width: "100%" }} />
        ) : (
          <Button title="Complete Flow" onPress={onNext} style={{ width: "100%" }} />
        )}
      </View>
    </View>
  );
}
