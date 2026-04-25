import type { Position } from "@xyflow/react";
import React from "react";

import { useTranslation } from "@repo/i18n";

import { nodeTypeColorMap } from "../react-flow/node-config";
import type { NodeType } from "./node-config";
import { NodeHandles } from "./node-handles";

interface NodeContentProps {
  title: string;
  nodeType: NodeType;
  hasInput: boolean;
  hasOutput: boolean;
  inputPosition: Position;
  outputPosition: Position;
  selected?: boolean;
  dragging?: boolean;
  isStartNode?: boolean;
}

export function NodeContent({
  title,
  nodeType,
  hasInput,
  hasOutput,
  inputPosition,
  outputPosition,
  selected,
  dragging,
  isStartNode = false,
}: NodeContentProps) {
  const { t } = useTranslation("experiments");
  const config = nodeTypeColorMap[nodeType];
  const accent = config.accent;

  return (
    <>
      <NodeHandles
        hasInput={hasInput}
        hasOutput={hasOutput}
        inputPosition={inputPosition}
        outputPosition={outputPosition}
        selected={selected}
        dragging={dragging}
        nodeType={nodeType}
      />
      {/* Compact horizontal layout with left padding for accent bar */}
      <div className="flex items-center gap-2 py-2.5 pl-4 pr-3">
        {/* Start node indicator — small green dot */}
        {isStartNode && (
          <div
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: "#49e06d" }}
            title={t("start")}
          />
        )}

        {/* Type icon — inline, accent-tinted */}
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
            color: accent,
          }}
        >
          {React.cloneElement(
            config.icon as React.ReactElement,
            { size: 14 } as Record<string, unknown>,
          )}
        </div>

        {/* Title */}
        <span
          className="truncate text-[13px] font-medium"
          style={{ color: "#011111", maxWidth: 140 }}
          title={title}
        >
          {title}
        </span>
      </div>
    </>
  );
}
