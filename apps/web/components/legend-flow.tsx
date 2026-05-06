import React from "react";

import { useTranslation } from "@repo/i18n/client";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";

import type { NodeType } from "./react-flow/node-config";
import { nodeTypeColorMap } from "./react-flow/node-config";

export function LegendFlow({
  overlay,
}: {
  // When overlay is true, the legend renders absolutely positioned within containerRef
  overlay?: boolean;
}) {
  const nodeTypes = Object.keys(nodeTypeColorMap) as NodeType[];

  const { t } = useTranslation(["experiments"]);

  const card = (
    <Card
      className={`w-full max-w-full border border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 md:w-48`}
    >
      <CardHeader>
        <CardTitle>{t("flow.legend")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3 md:flex md:flex-col md:gap-2">
        {nodeTypes.map((type) => {
          const accent = nodeTypeColorMap[type].accent;
          return (
            <div
              key={type}
              role="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/reactflow", type)}
              tabIndex={0}
              className="flex items-center gap-2 rounded-[10px] border px-2.5 py-2 shadow-sm transition-transform hover:scale-105"
              style={{
                borderColor: "#EDF2F6",
                backgroundColor: "#FFFFFF",
                borderLeftWidth: 4,
                borderLeftColor: accent,
              }}
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
                  color: accent,
                }}
              >
                {React.cloneElement(
                  nodeTypeColorMap[type].icon as React.ReactElement,
                  { size: 14 } as Record<string, unknown>,
                )}
              </div>
              <span className="text-xs font-medium" style={{ color: "#011111" }}>
                {t(`flow.nodeTypes.${type}`)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  if (overlay) {
    return (
      <div className={`pointer-events-auto absolute bottom-4 right-4 z-10 hidden md:block`}>
        {card}
      </div>
    );
  }

  return card;
}
