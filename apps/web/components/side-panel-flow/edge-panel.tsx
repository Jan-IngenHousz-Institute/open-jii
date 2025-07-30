import type { Edge } from "@xyflow/react";
import React, { useState, useEffect } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

export interface EdgeSidePanelProps {
  open: boolean;
  selectedEdge: Edge | null;
  onClose: () => void;
  onEdgeUpdate: (edgeId: string, updates: Partial<Edge>) => void;
  onEdgeDelete: (edgeId: string) => void;
}

export function EdgeSidePanel({
  open,
  selectedEdge,
  onClose,
  onEdgeUpdate,
  onEdgeDelete,
}: EdgeSidePanelProps) {
  // Keep previous content during transition
  const [displayEdge, setDisplayEdge] = useState<Edge | null>(selectedEdge);
  const [currentLabel, setCurrentLabel] = useState("");

  const getEditableLabelString = (edge: Edge): string => {
    if (edge.label == null) return "";
    if (typeof edge.label === "string") return edge.label;
    if (typeof edge.label === "number") return edge.label.toString();
    return "";
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value;
    setCurrentLabel(newLabel);
    if (displayEdge) {
      onEdgeUpdate(displayEdge.id, { label: newLabel });
    }
  };

  const handleAnimationToggle = (checked: boolean) => {
    if (displayEdge) {
      onEdgeUpdate(displayEdge.id, { animated: checked });
    }
  };

  const handleDeleteEdge = () => {
    if (displayEdge) {
      onEdgeDelete(displayEdge.id);
      onClose();
    }
  };

  useEffect(() => {
    if (open && selectedEdge) {
      // Immediately update content when opening
      setDisplayEdge(selectedEdge);
      // Get the editable label string
      const labelStr = getEditableLabelString(selectedEdge);
      setCurrentLabel(labelStr);
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
          "fixed inset-0 top-[-33] z-40 bg-black transition-opacity duration-300 " +
          (open && selectedEdge
            ? "pointer-events-auto bg-opacity-60 opacity-100"
            : "pointer-events-none bg-opacity-0 opacity-0")
        }
        onClick={onClose}
        aria-label="Close edge panel backdrop"
      />
      <div
        className={
          "fixed right-0 top-[-33] z-50 flex h-screen w-[30vw] flex-col rounded-bl-2xl rounded-tl-2xl border-l border-gray-200 bg-white shadow-[-8px_0_30px_-8px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-in-out " +
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
                value={currentLabel}
                onChange={handleLabelChange}
                placeholder="Enter edge label..."
                className="focus:border-jii-dark-green focus:ring-jii-dark-green w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50"
              />
            </CardContent>
          </Card>

          {/* Animation Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-jii-dark-green">Animation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">Animate this edge</span>
                <label className="relative inline-flex cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!displayEdge?.animated}
                    onChange={(e) => handleAnimationToggle(e.target.checked)}
                    className="peer sr-only"
                  />
                  {/* track */}
                  <div className="peer-checked:bg-jii-dark-green h-5 w-10 rounded-full bg-gray-200 transition-colors" />
                  {/* thumb */}
                  <div className="absolute left-0.5 top-0.5 h-4 w-4 transform rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
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
                  className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                  onClick={handleDeleteEdge}
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
