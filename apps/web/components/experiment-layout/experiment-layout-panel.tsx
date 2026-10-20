"use client";

import { useExperimentLayout } from "@/hooks/experiment/useExperimentLayout/useExperimentLayout";
import { useState } from "react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

import { LayoutAnchorCard } from "./layout-anchor-card";
import { LayoutGrid } from "./layout-grid";
import { LayoutPlotPanel } from "./layout-plot-panel";
import { LayoutSetupCard } from "./layout-setup-card";

interface ExperimentLayoutPanelProps {
  experimentId: string;
  canEdit: boolean;
}

type LayoutSide = { kind: "plot"; plotId: string } | { kind: "anchor" } | null;

export function ExperimentLayoutPanel({ experimentId, canEdit }: ExperimentLayoutPanelProps) {
  const { t } = useTranslation("experiments");
  const { data: layout, isLoading } = useExperimentLayout(experimentId);
  const [side, setSide] = useState<LayoutSide>(null);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!layout) {
    return <EmptyState title={t("layout.empty")} description={t("layout.emptyDescription")} />;
  }

  const isSideOpen = side !== null;
  const selectedPlotId = side?.kind === "plot" ? side.plotId : null;

  const selectPlot = (unit: ExperimentUnit) => {
    setSide({ kind: "plot", plotId: unit.id });
  };

  const openAnchor = () => {
    setSide({ kind: "anchor" });
  };

  const closeSide = () => {
    setSide(null);
  };

  return (
    <div
      className={cn(
        "grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]",
        isSideOpen && "xl:grid-cols-[320px_minmax(0,1fr)_300px]",
      )}
    >
      {canEdit ? <LayoutSetupCard layout={layout} /> : null}
      <LayoutGrid
        layout={layout}
        selectedPlotId={selectedPlotId}
        onSelectPlot={selectPlot}
        onAnchor={canEdit ? openAnchor : undefined}
      />
      {side?.kind === "plot" ? (
        <LayoutPlotPanel experimentId={experimentId} plotId={side.plotId} onClose={closeSide} />
      ) : null}
      {side?.kind === "anchor" ? <LayoutAnchorCard layout={layout} onClose={closeSide} /> : null}
    </div>
  );
}
