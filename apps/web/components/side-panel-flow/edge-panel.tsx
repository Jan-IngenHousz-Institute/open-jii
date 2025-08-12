import type { Edge } from "@xyflow/react";
import React, { useState, useEffect } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

export interface EdgeSidePanelProps {
  open: boolean;
  selectedEdge: Edge | null;
  onClose: () => void;
  onEdgeUpdate?: (edgeId: string, updates: Partial<Edge>) => void;
  onEdgeDelete?: (edgeId: string) => void;
  isDisabled?: boolean;
}

export function EdgeSidePanel({
  open,
  selectedEdge,
  onClose,
  onEdgeUpdate,
  onEdgeDelete,
  isDisabled = false,
}: EdgeSidePanelProps) {
  // Keep previous content during transition
  const [displayEdge, setDisplayEdge] = useState<Edge | null>(selectedEdge);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    const newLabel = e.target.value;
    if (displayEdge) {
      const updatedEdge = { ...displayEdge, data: { ...displayEdge.data, label: newLabel } };
      setDisplayEdge(updatedEdge);
      onEdgeUpdate?.(displayEdge.id, { data: { ...displayEdge.data, label: newLabel } });
    }
  };

  const handleDeleteEdge = () => {
    if (isDisabled) return;
    if (displayEdge && onEdgeDelete) {
      onEdgeDelete(displayEdge.id);
      onClose();
    }
  };

  // Helper to get the label string for the input
  const getEdgeLabel = (edge: Edge | null): string => {
    if (!edge) return "";
    const label = edge.data?.label ?? edge.label;
    return typeof label === "string" || typeof label === "number" ? String(label) : "";
  };

  useEffect(() => {
    if (open && selectedEdge) {
      // Immediately update content when opening
      setDisplayEdge(selectedEdge);
    } else if (!open) {
      // Delay clearing content until transition ends (300ms)
      const timeout = setTimeout(() => {
        setDisplayEdge(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open, selectedEdge]);

  return (
    <>
      {/* Always render backdrop for fade animation */}
      <div
        className={
          "fixed inset-0 z-40 bg-black transition-opacity duration-300 " +
          (open && selectedEdge
            ? "pointer-events-auto bg-opacity-60 opacity-100"
            : "pointer-events-none bg-opacity-0 opacity-0")
        }
        onClick={onClose}
        aria-label="Close edge panel backdrop"
      />
      <div
        className={
          "fixed bottom-0 right-0 top-0 z-50 flex w-[30vw] flex-col rounded-bl-2xl rounded-tl-2xl border-l border-gray-200 bg-white shadow-[-8px_0_30px_-8px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-in-out " +
          (open && selectedEdge ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="flex-1 overflow-y-auto p-6">
          <button
            type="button"
            className="text-jii-dark-green hover:text-jii-medium-green absolute right-4 top-4 text-xl font-bold"
            onClick={onClose}
          >
            &times;
          </button>
          <h2 className="text-jii-dark-green mb-4 text-xl font-bold">Edge Settings</h2>

          {/* Edge Label */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-jii-dark-green">Label</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                id="edge-label"
                type="text"
                value={getEdgeLabel(displayEdge)}
                onChange={handleLabelChange}
                placeholder="Enter edge label..."
                disabled={isDisabled}
                className="focus:border-jii-dark-green focus:ring-jii-dark-green w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </CardContent>
          </Card>

          {/* Edge Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-jii-dark-green">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <button
                  type="button"
                  className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-400"
                  onClick={handleDeleteEdge}
                  disabled={isDisabled}
                >
                  Remove Edge
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
