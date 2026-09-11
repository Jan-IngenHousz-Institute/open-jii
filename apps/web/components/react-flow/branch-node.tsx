import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import React from "react";

import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
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
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className={cn(
              "text-muted-foreground pointer-events-auto absolute -right-2 -top-2 z-20 size-5 rounded-full opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
              isActive && "opacity-100",
            )}
            title="Delete node"
            onClick={handleDelete}
            aria-label="Delete node"
          >
            <span className="text-[13px] font-medium leading-none">×</span>
          </Button>
        )}

        <Card
          data-testid="node-card"
          className={cn(
            "relative gap-0 overflow-hidden py-0",
            isActive && "border-primary ring-primary ring-2",
          )}
        >
          <div className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: accent }} />

          <Handle
            type="target"
            position={Position.Left}
            id="in"
            className="!h-2 !w-2 !rounded-full !border transition-colors duration-150"
            style={{
              backgroundColor: "var(--card)",
              borderColor: isActive ? "var(--primary)" : accent,
              borderWidth: isActive ? 2 : 1.5,
              top: HEADER_HEIGHT / 2,
            }}
          />

          <div
            className="flex items-center gap-3 px-3 pl-4"
            style={{ borderBottom: "1px solid var(--border)", height: HEADER_HEIGHT }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
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
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--status-active-foreground)" }}
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
                className="text-foreground line-clamp-2 break-words text-[13px] font-semibold leading-tight"
                title={title}
              >
                {title}
              </span>
            </div>
          </div>

          {paths.length === 0 ? (
            <div className="text-muted-foreground px-4 py-3 text-[12px] italic">
              No paths configured
            </div>
          ) : (
            <div className="py-1.5">
              {paths.map((path, idx) => {
                const isDefault = defaultPathId === path.id;
                return (
                  <div
                    key={path.id}
                    className="hover:bg-muted relative flex items-center gap-2 px-3 pl-4 pr-5 transition-colors"
                    style={{ height: PATH_ROW_HEIGHT }}
                  >
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: path.color || accent }}
                    />
                    <span
                      className="text-foreground truncate text-[12.5px] font-medium"
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
                        backgroundColor: "var(--card)",
                        borderColor: path.color || accent,
                        top: "50%",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
