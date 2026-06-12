import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import React from "react";

import { cn } from "@repo/ui/lib/utils";

import { nodeTypeColorMap } from "./node-config";

interface BranchPathSummary {
  id: string;
  label: string;
  color: string;
}

interface BranchNodeProps extends NodeProps {
  nodes: Node[];
  onNodeSelect?: (node: Node | null) => void;
  onNodeDelete: (nodeId: string) => void;
  isStatic?: boolean;
}

const PATH_ROW_HEIGHT = 32;
const HEADER_HEIGHT = 60;

export function BranchNode(props: BranchNodeProps) {
  const { nodes, onNodeSelect, onNodeDelete, isStatic = false, ...nodeProps } = props;
  const data = nodeProps.data as {
    title?: string;
    isStartNode?: boolean;
    stepSpecification?: { paths?: BranchPathSummary[]; defaultPathId?: string };
  };
  const title = data.title ?? "Branch";
  const paths = data.stepSpecification?.paths ?? [];
  const defaultPathId = data.stepSpecification?.defaultPathId;
  const accent = nodeTypeColorMap.BRANCH.accent;
  const isActive = nodeProps.selected || nodeProps.dragging;

  const handleSelect = () => {
    const node = nodes.find((n) => n.id === nodeProps.id) ?? null;
    if (onNodeSelect) onNodeSelect(node);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeDelete(nodeProps.id);
  };

  return (
    <div onClick={handleSelect}>
      <div className="group relative inline-block w-[260px] bg-transparent p-0" tabIndex={0}>
        {!isStatic && (
          <button
            className={cn(
              "pointer-events-auto absolute -right-2 -top-2 z-20 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-white text-xs opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
              isActive && "opacity-100",
            )}
            style={{
              border: `1px solid #EDF2F6`,
              color: "#68737B",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
            title="Delete node"
            onClick={handleDelete}
            aria-label="Delete node"
          >
            <span className="text-[13px] font-medium leading-none">×</span>
          </button>
        )}

        <div
          data-testid="node-card"
          className={cn(
            "relative overflow-hidden rounded-[12px] transition-shadow duration-150 group-hover:shadow-md",
            isActive && "ring-jii-dark-green ring-2",
          )}
          style={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${isActive ? "#005e5e" : "#E2E8F0"}`,
            boxShadow: isActive
              ? "0 8px 20px -6px rgba(0, 94, 94, 0.18), 0 2px 4px rgba(0, 0, 0, 0.04)"
              : "0 4px 8px -4px rgba(15, 23, 42, 0.10), 0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: accent }} />

          <Handle
            type="target"
            position={Position.Left}
            id="in"
            className="!h-2 !w-2 !rounded-full !border transition-colors duration-150"
            style={{
              backgroundColor: "#FFFFFF",
              borderColor: isActive ? "#005e5e" : accent,
              borderWidth: isActive ? 2 : 1.5,
              top: HEADER_HEIGHT / 2,
            }}
          />

          <div
            className="flex items-center gap-3 px-3 pl-4"
            style={{ borderBottom: "1px solid #E2E8F0", height: HEADER_HEIGHT }}
          >
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                color: accent,
              }}
            >
              <GitBranch size={18} strokeWidth={2} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                {data.isStartNode && (
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: "#22C55E" }}
                    title="Start"
                  />
                )}
                <span
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: accent, letterSpacing: "0.06em" }}
                >
                  Branch
                </span>
              </div>
              <span
                className="line-clamp-2 break-words text-[13px] font-semibold leading-tight text-slate-900"
                title={title}
              >
                {title}
              </span>
            </div>
          </div>

          {paths.length === 0 ? (
            <div className="px-4 py-3 text-[12px] italic text-slate-400">No paths configured</div>
          ) : (
            <div className="py-1.5">
              {paths.map((path, idx) => {
                const isDefault = defaultPathId === path.id;
                return (
                  <div
                    key={path.id}
                    className="relative flex items-center gap-2 px-3 pl-4 pr-5 transition-colors hover:bg-slate-50"
                    style={{ height: PATH_ROW_HEIGHT }}
                  >
                    <div
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: path.color || accent }}
                    />
                    <span
                      className="truncate text-[12.5px] font-medium text-slate-700"
                      title={path.label}
                    >
                      {path.label || `Path ${idx + 1}`}
                    </span>
                    {isDefault && (
                      <span
                        className="ml-auto rounded-full px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                          color: accent,
                        }}
                      >
                        default
                      </span>
                    )}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={path.id}
                      className="!h-2.5 !w-2.5 !rounded-full !border-2 transition-colors duration-150"
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderColor: path.color || accent,
                        top: "50%",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
