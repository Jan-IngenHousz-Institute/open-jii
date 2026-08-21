import { SettingsCard } from "@/components/shared/settings-card";
import type { Edge, Node } from "@xyflow/react";
import { Info } from "lucide-react";
import React, { useState, useEffect } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import { AnalysisPanel } from "./analysis-panel";
import type { InlineCommandValue } from "./command-panel";
import { CommandPanel } from "./command-panel";
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

// Format label as column name
function formatNodeLabelAsColumnName(title: string): string {
  let sanitized = title.toLowerCase().replace(/[ ,;{}()\n\t=]+/g, "_");
  sanitized = sanitized.replace(/^_+|_+$/g, "").replace(/_+/g, "_");
  if (!sanitized || /^\d/.test(sanitized)) {
    sanitized = `question_${sanitized}`;
  }
  return sanitized;
}

/**
 * Walk edges backward from a node to find the nearest upstream MEASUREMENT node's protocolId.
 */
function findUpstreamProtocolId(nodeId: string, nodes: Node[], edges: Edge[]): string | undefined {
  const visited = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all edges pointing TO this node (current is the target)
    for (const edge of edges) {
      if (edge.target === current) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (!sourceNode) continue;

        if (
          sourceNode.type === "MEASUREMENT" &&
          typeof sourceNode.data.protocolId === "string" &&
          sourceNode.data.protocolId
        ) {
          return sourceNode.data.protocolId;
        }

        queue.push(edge.source);
      }
    }
  }

  return undefined;
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
  onEdgeUpdate?: (edgeId: string, updates: Partial<Edge>) => void;
  onEdgeDelete?: (edgeId: string) => void;
  nodes?: Node[]; // Add nodes to check for existing start/end nodes
  edges?: Edge[]; // Edges for upstream protocol lookup
  isDisabled?: boolean; // Whether the panel is read-only
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
  edges = [],
  isDisabled = false,
}: ExperimentSidePanelProps) {
  // Keep previous content during transition
  const [displayNodeType, setDisplayNodeType] = useState(nodeType);
  const [currentTitle, setCurrentTitle] = useState(nodeTitle ?? "");

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    const newTitle = e.target.value;
    setCurrentTitle(newTitle);
    if (onTitleChange) {
      onTitleChange(newTitle);
    }
  };

  const { t } = useTranslation("experiments");

  useEffect(() => {
    if (open && nodeType) {
      // Immediately update content when opening
      setDisplayNodeType(nodeType);
      setCurrentTitle(nodeTitle ?? "");
    }
  }, [open, nodeType, nodeTitle]);

  return (
    <>
      {/* Node Side Panel */}
      <div
        className={
          "fixed inset-0 z-50 transition-opacity duration-300 " +
          (open && nodeType
            ? "bg-sidebar/60 pointer-events-auto opacity-100"
            : "bg-sidebar/0 pointer-events-none opacity-0")
        }
        onClick={onClose}
        aria-label="Close side panel backdrop"
      />
      <div
        className={
          "bg-card fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col rounded-none border-none shadow-none transition-transform duration-300 ease-in-out " +
          "md:border-border md:w-[480px] md:rounded-bl-xl md:rounded-tl-xl md:border-l md:shadow-2xl" +
          (open && nodeType ? " translate-x-0" : " translate-x-full")
        }
      >
        <div className="flex-1 overflow-y-auto p-6">
          <Button
            type="button"
            variant="ghost"
            className="text-primary hover:text-primary/80 absolute right-6 top-6 h-auto p-0 text-xl font-bold hover:bg-transparent"
            onClick={onClose}
          >
            &times;
          </Button>
          <h2 className="text-primary mb-4 text-xl font-bold">
            {displayNodeType
              ? displayNodeType.charAt(0) + displayNodeType.slice(1).toLowerCase()
              : ""}{" "}
            {t("sidePanelFlow.nodePanel")}
          </h2>

          {/* Label input field wrapped in Card */}
          <SettingsCard
            title={t("sidePanelFlow.label")}
            action={
              displayNodeType === "QUESTION" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="text-muted-foreground hover:text-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-medium">{t("flow.questionTooltip.title")}</p>
                        <p className="text-xs">
                          {t("flow.questionTooltip.description")}
                          <span className="bg-foreground text-background ml-1 rounded px-1 font-mono text-xs">
                            {currentTitle
                              ? formatNodeLabelAsColumnName(currentTitle)
                              : t("flow.questionTooltip.defaultColumnName")}
                          </span>
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }
            className="mb-6"
          >
            <Input
              id="node-label"
              type="text"
              value={currentTitle}
              onChange={handleTitleChange}
              placeholder={t("sidePanelFlow.labelPlaceholder")}
              disabled={isDisabled}
              required={displayNodeType === "QUESTION"}
              aria-required={displayNodeType === "QUESTION"}
              className="w-full"
            />
            {displayNodeType === "QUESTION" && (
              <p className="text-muted-foreground mt-1.5 text-xs">{t("sidePanelFlow.labelHint")}</p>
            )}
          </SettingsCard>

          {/* Node Type Toggles */}
          {selectedNode && (
            <SettingsCard title={t("sidePanelFlow.nodeProperties")} contentClassName="space-y-4">
              {/* Start Node Toggle */}
              <Card className="flex-row items-center justify-between gap-0 p-4">
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {t("sidePanelFlow.startNode")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("sidePanelFlow.startNodeLimit")}
                  </p>
                </div>
                <Switch
                  aria-label={t("sidePanelFlow.startNode")}
                  checked={Boolean(selectedNode.data.isStartNode)}
                  onCheckedChange={() => {
                    if (isDisabled) return;
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
                  disabled={
                    isDisabled ||
                    (!selectedNode.data.isStartNode &&
                      nodes.some((node) => node.id !== selectedNode.id && node.data.isStartNode))
                  }
                />
              </Card>
            </SettingsCard>
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
              disabled={isDisabled}
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
              disabled={isDisabled}
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
              disabled={isDisabled}
            />
          )}
          {/* CommandPanel for inline-command node */}
          {displayNodeType === "COMMAND" && selectedNode && (
            <CommandPanel
              command={selectedNode.data.command as InlineCommandValue | undefined}
              onChange={(command) => {
                if (onNodeDataChange) {
                  onNodeDataChange(selectedNode.id, {
                    ...selectedNode.data,
                    command,
                  });
                }
              }}
              disabled={isDisabled}
            />
          )}
          {/* AnalysisPanel for analysis node */}
          {displayNodeType === "ANALYSIS" && selectedNode && (
            <AnalysisPanel
              selectedMacroId={
                typeof selectedNode.data.macroId === "string" ? selectedNode.data.macroId : ""
              }
              onChange={(macroId) => {
                if (onNodeDataChange) {
                  onNodeDataChange(selectedNode.id, {
                    ...selectedNode.data,
                    macroId,
                  });
                }
              }}
              disabled={isDisabled}
              upstreamProtocolId={findUpstreamProtocolId(selectedNode.id, nodes, edges)}
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
        isDisabled={isDisabled}
      />
    </>
  );
}
