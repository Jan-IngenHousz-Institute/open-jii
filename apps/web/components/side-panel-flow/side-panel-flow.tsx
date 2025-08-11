import type { Edge, Node } from "@xyflow/react";
import React, { useState, useEffect } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import { AnalysisPanel } from "./analysis-panel";
import { EdgeSidePanel } from "./edge-panel";
import { InstructionPanel } from "./instruction-panel";
import { MeasurementPanel } from "./measurement-panel";
import { QuestionPanel } from "./question-panel";

// Local mirror of QuestionUI (not exported from question-panel)
interface QuestionUI {
  answerType: "TEXT" | "SELECT" | "NUMBER" | "BOOLEAN";
  validationMessage?: string;
  options?: string[];
  required: boolean;
}

// Helper to detect QuestionUI spec shape
function isQuestionUI(obj: unknown): obj is QuestionUI {
  if (typeof obj !== "object" || obj === null) return false;
  const rec = obj as Record<string, unknown>;
  return (
    typeof rec.answerType === "string" &&
    typeof rec.required === "boolean" &&
    (rec.options === undefined || Array.isArray(rec.options))
  );
}

export interface ExperimentSidePanelProps {
  open: boolean;
  selectedNode?: Node | null;
  nodeType?: string;
  nodeTitle?: string;
  onClose: () => void;
  onTitleChange?: (newTitle: string) => void;
  onNodeDataChange?: (nodeId: string, data: Record<string, unknown>) => void;
  selectedEdge?: Edge | null;
  onEdgeUpdate: (edgeId: string, updates: Partial<Edge>) => void;
  onEdgeDelete: (edgeId: string) => void;
  nodes?: Node[]; // Add nodes to check for existing start/end nodes
}

export function ExperimentSidePanel({
  open,
  selectedNode,
  nodeType,
  nodeTitle,
  onClose,
  onTitleChange,
  onNodeDataChange,
  selectedEdge,
  onEdgeUpdate,
  onEdgeDelete,
  nodes = [],
}: ExperimentSidePanelProps) {
  // Keep previous content during transition
  const [displayNodeType, setDisplayNodeType] = useState(nodeType);
  const [currentTitle, setCurrentTitle] = useState(nodeTitle ?? "");

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setCurrentTitle(newTitle);
    if (onTitleChange) {
      onTitleChange(newTitle);
    }
  };

  useEffect(() => {
    if (open && nodeType) {
      // Immediately update content when opening
      setDisplayNodeType(nodeType);
      setCurrentTitle(nodeTitle ?? "");
    } else if (!open) {
      // Delay clearing content until transition ends (300ms)
      const timeout = setTimeout(() => {
        setDisplayNodeType(undefined);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open, nodeType, nodeTitle]);

  return (
    <>
      {/* Node Side Panel */}
      <div
        className={
          "fixed inset-0 top-[-33] z-40 bg-black transition-opacity duration-300 " +
          (open && nodeType
            ? "pointer-events-auto bg-opacity-60 opacity-100"
            : "pointer-events-none bg-opacity-0 opacity-0")
        }
        onClick={onClose}
        aria-label="Close side panel backdrop"
      />
      <div
        className={
          "fixed right-0 top-[-33] z-50 flex h-screen w-full flex-col rounded-none border-none bg-white shadow-none transition-transform duration-300 ease-in-out " +
          "md:w-[30vw] md:rounded-bl-xl md:rounded-tl-xl md:border-l md:border-gray-200 md:bg-white md:shadow-[-8px_0_30px_-8px_rgba(0,0,0,0.3)]" +
          (open && nodeType ? " translate-x-0" : " translate-x-full")
        }
      >
        <div className="flex-1 overflow-y-auto p-6">
          <button
            type="button"
            className="text-jii-dark-green hover:text-jii-medium-green absolute right-6 top-6 text-xl font-bold"
            onClick={onClose}
          >
            &times;
          </button>
          <h2 className="text-jii-dark-green mb-4 text-xl font-bold">
            {displayNodeType
              ? displayNodeType.charAt(0) + displayNodeType.slice(1).toLowerCase()
              : ""}{" "}
            Node Panel
          </h2>

          {/* Label input field wrapped in Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-jii-dark-green">Label</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                id="node-label"
                type="text"
                value={currentTitle}
                onChange={handleTitleChange}
                placeholder="Enter node title..."
                className="focus:border-jii-dark-green focus:ring-jii-dark-green w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50"
              />
            </CardContent>
          </Card>

          {/* Node Type Toggles */}
          {selectedNode && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-jii-dark-green">Node Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Start Node Toggle */}
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Start Node</p>
                    <p className="text-xs text-gray-500">Limited to one per flow</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedNode.data.isStartNode)}
                      onChange={() => {
                        const currentIsStart = selectedNode.data.isStartNode;
                        const hasOtherStartNode = nodes.some(
                          (node) => node.id !== selectedNode.id && node.data.isStartNode,
                        );

                        // Only allow toggling on if there's no other start node
                        if (!currentIsStart && hasOtherStartNode) {
                          return; // Don't allow multiple start nodes
                        }

                        if (onNodeDataChange) {
                          onNodeDataChange(selectedNode.id, {
                            ...selectedNode.data,
                            isStartNode: !currentIsStart,
                            // Clear end node if setting as start node
                            isEndNode: !currentIsStart ? false : selectedNode.data.isEndNode,
                          });
                        }
                      }}
                      className="peer sr-only"
                      disabled={
                        !selectedNode.data.isStartNode &&
                        nodes.some((node) => node.id !== selectedNode.id && node.data.isStartNode)
                      }
                    />
                    <div className="peer-checked:bg-jii-dark-green peer-focus:ring-jii-dark-green/20 peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-disabled:bg-gray-300"></div>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* InstructionPanel for instruction node */}
          {displayNodeType === "INSTRUCTION" && selectedNode && (
            <InstructionPanel
              value={
                typeof selectedNode.data.description === "string"
                  ? selectedNode.data.description
                  : ""
              }
              onChange={(val) => {
                if (onNodeDataChange) {
                  onNodeDataChange(selectedNode.id, {
                    ...selectedNode.data,
                    description: val,
                  });
                }
              }}
            />
          )}
          {displayNodeType === "QUESTION" && selectedNode && (
            <QuestionPanel
              stepSpecification={
                isQuestionUI(selectedNode.data.stepSpecification)
                  ? selectedNode.data.stepSpecification
                  : ({
                      answerType: "TEXT",
                      required: false,
                      validationMessage: currentTitle || "",
                    } satisfies QuestionUI)
              }
              onChange={(spec) => {
                if (onNodeDataChange) {
                  onNodeDataChange(selectedNode.id, {
                    ...selectedNode.data,
                    stepSpecification: spec,
                  });
                }
              }}
            />
          )}

          {/* MeasurementPanel for measurement node */}
          {displayNodeType === "MEASUREMENT" && selectedNode && (
            <MeasurementPanel
              selectedProtocolId={
                typeof selectedNode.data.protocolId === "string" ? selectedNode.data.protocolId : ""
              }
              onChange={(protocolId) => {
                if (onNodeDataChange) {
                  onNodeDataChange(selectedNode.id, {
                    ...selectedNode.data,
                    protocolId,
                  });
                }
              }}
            />
          )}
          {/* AnalysisPanel for analysis node */}
          {displayNodeType === "ANALYSIS" && selectedNode && (
            <AnalysisPanel
              selectedMeasurementOption={
                typeof selectedNode.data.measurementOption === "string"
                  ? selectedNode.data.measurementOption
                  : ""
              }
              onChange={(measurementOption) => {
                if (onNodeDataChange) {
                  onNodeDataChange(selectedNode.id, {
                    ...selectedNode.data,
                    measurementOption,
                  });
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Edge Side Panel */}
      <EdgeSidePanel
        open={!!selectedEdge}
        selectedEdge={selectedEdge ?? null}
        onClose={onClose}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeDelete={onEdgeDelete}
      />
    </>
  );
}
