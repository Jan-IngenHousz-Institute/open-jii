import React from "react";

import { useTranslation } from "@repo/i18n/client";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

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
      <CardContent className="flex flex-wrap gap-3 md:flex md:flex-col md:gap-3">
        {nodeTypes.map((type) => {
          const colorClass = `${nodeTypeColorMap[type].border} ${nodeTypeColorMap[type].bg}`;
          return (
            <div
              key={type}
              role="button"
              tabIndex={0}
              className={`flex items-center rounded-lg border md:gap-2 ${colorClass} gap-1 px-2 py-1 shadow-md transition-transform hover:scale-105 md:py-2`}
            >
              <div className="text-slate-600">
                {React.cloneElement(
                  nodeTypeColorMap[type].icon as React.ReactElement,
                  { size: 20 } as Record<string, unknown>,
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{t(`flow.nodeTypes.${type}`)}</span>
              </div>
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
