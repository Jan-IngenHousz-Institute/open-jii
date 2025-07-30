import type { Edge, Node } from "@xyflow/react";
import React, { useState, useEffect } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import { EdgeSidePanel } from "./edge-panel";
import { InstructionPanel } from "./instruction-panel";
import { QuestionPanel } from "./question-panel";

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
          {/* QuestionPanel for question node */}
          {displayNodeType === "QUESTION" && <QuestionPanel />}
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
