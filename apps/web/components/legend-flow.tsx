import { SettingsCard } from "@/components/shared/settings-card";
import React from "react";

import { useTranslation } from "@repo/i18n/client";
import { Card } from "@repo/ui/components/card";

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
    <SettingsCard
      title={t("flow.legend")}
      className="w-full max-w-full md:w-48"
      contentClassName="flex flex-wrap gap-3 md:flex md:flex-col md:gap-2"
    >
      {nodeTypes.map((type) => {
        const accent = nodeTypeColorMap[type].accent;
        return (
          <Card
            key={type}
            role="button"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("application/reactflow", type)}
            tabIndex={0}
            className="flex-row items-center gap-2 px-2.5 py-2"
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
            <span className="text-foreground text-xs font-medium">
              {t(`flow.nodeTypes.${type}`)}
            </span>
          </Card>
        );
      })}
    </SettingsCard>
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
