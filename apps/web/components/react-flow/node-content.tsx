import type { Position } from "@xyflow/react";
import React from "react";

import { useTranslation } from "@repo/i18n";

import { nodeTypeColorMap } from "../react-flow/node-config";
import type { NodeType } from "./node-config";
import { NodeHandles } from "./node-handles";

const TYPE_LABELS: Record<NodeType, string> = {
  INSTRUCTION: "Instruction",
  QUESTION: "Question",
  MEASUREMENT: "Protocol",
  ANALYSIS: "Macro",
  BRANCH: "Branch",
  COMMAND: "Command",
};

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
  const typeLabel = TYPE_LABELS[nodeType];

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
      <div className="flex items-center gap-3 py-3 pl-4 pr-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
            color: accent,
          }}
        >
          {React.cloneElement(
            config.icon as React.ReactElement,
            { size: 18 } as Record<string, unknown>,
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {isStartNode && (
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: "#22C55E" }}
                title={t("start")}
              />
            )}
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: accent, letterSpacing: "0.06em" }}
            >
              {typeLabel}
            </span>
          </div>
          <span
            className="line-clamp-2 break-words text-[13px] font-semibold leading-tight text-slate-900"
            title={title}
          >
            {title || (
              <span className="font-normal italic text-slate-400">{t("flow.untitledNode")}</span>
            )}
          </span>
        </div>
      </div>
    </>
  );
}
