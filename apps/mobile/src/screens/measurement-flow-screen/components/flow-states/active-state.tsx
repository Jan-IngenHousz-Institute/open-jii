import React from "react";
import { View } from "react-native";
import { Button } from "~/components/Button";
import { FlowNode } from "../../types";

import { FlowProgressIndicator } from "../flow-progress-indicator";
import { AnalysisNode } from "../flow-nodes/analysis-node";
import { InstructionNode } from "../flow-nodes/instruction-node";
import { MeasurementNode } from "../flow-nodes/measurement-node";
import { QuestionNode } from "../flow-nodes/question-node";

interface ActiveStateProps {
  currentNode: FlowNode;
  currentFlowStep: number;
  flowNodesLength: number;
  iterationCount: number;
  onNext: () => void;
  onUpload?: () => void;
  onRetry?: () => void;
  onFinish?: () => void;
}

export function ActiveState({
  currentNode,
  currentFlowStep,
  flowNodesLength,
  iterationCount,
  onNext,
  onUpload,
  onRetry,
  onFinish,
}: ActiveStateProps) {
  return (
    <View>
      <FlowProgressIndicator 
        currentStep={currentFlowStep}
        totalSteps={flowNodesLength}
        iterationCount={iterationCount}
      />
      
      {currentNode.type === "instruction" && <InstructionNode content={currentNode.content} />}
      {currentNode.type === "question" && <QuestionNode content={currentNode.content} />}
      {currentNode.type === "measurement" && <MeasurementNode content={currentNode.content} />}
      {currentNode.type === "analysis" && <AnalysisNode content={currentNode.content} />}

      <View className="mt-8 items-center">
        {currentFlowStep < flowNodesLength - 1 ? (
          <Button title="Next" onPress={onNext} style={{ width: "100%" }} />
        ) : (
          <View className="w-full">
            <View className="space-y-4">
              <Button 
                title="Upload and Continue" 
                onPress={onUpload} 
                style={{ width: "100%" }} 
              />
              <View className="pt-2">
                <Button 
                  title="Repeat Cycle" 
                  variant="outline" 
                  onPress={onRetry} 
                  style={{ 
                    width: "100%", 
                    borderColor: "#ef4444",
                    borderWidth: 1
                  }}
                  textStyle={{ color: "#ef4444" }}
                />
              </View>
            </View>
            
            <View className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button 
                title="Finish flow" 
                variant="ghost" 
                onPress={onFinish} 
                size="lg"
                style={{ 
                  width: "100%", 
                  borderColor: "#10b981",
                  borderWidth: 2
                }}
                textStyle={{ color: "#10b981", fontSize: 18, fontWeight: "600" }}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
