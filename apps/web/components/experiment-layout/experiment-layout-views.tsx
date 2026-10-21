"use client";

import { useExperimentLayout } from "@/hooks/experiment/useExperimentLayout/useExperimentLayout";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ExperimentLayoutPanel } from "./experiment-layout-panel";
import { LayoutLegendSpecimen } from "./layout-legend-specimen";
import { LayoutNeedsPlots } from "./layout-needs-plots";
import type { LayoutView } from "./layout-view";
import { isLayoutView, LAYOUT_VIEW_PARAM } from "./layout-view";
import { LayoutViewSwitch } from "./layout-view-switch";

export interface ExperimentLayoutViewsProps {
  experimentId: string;
  canEdit: boolean;
  /** The Walking order view once the experiment has plots. */
  walkingOrder: ReactNode;
  /** The Field days view once the experiment has plots. */
  fieldDays: ReactNode;
  /** The view shown when the address names none. */
  defaultView?: LayoutView;
}

/**
 * The Layout tab: one switch over Plots, Walking order and Field days. Each view owns its grid
 * mode, side panel and empty state; before any plots exist every view leads to Define layout.
 */
export function ExperimentLayoutViews({
  experimentId,
  canEdit,
  walkingOrder,
  fieldDays,
  defaultView = "plots",
}: ExperimentLayoutViewsProps) {
  const { t } = useTranslation("experiments");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: layout, isLoading, isError, refetch } = useExperimentLayout(experimentId);
  const [isDefining, setIsDefining] = useState(false);

  const requested = searchParams.get(LAYOUT_VIEW_PARAM);
  const view = isLayoutView(requested) ? requested : defaultView;
  const hasPlots = layout !== null && layout !== undefined;

  const showView = (next: LayoutView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(LAYOUT_VIEW_PARAM, next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const defineLayout = () => {
    setIsDefining(true);
    showView("plots");
  };

  const retry = () => {
    void refetch();
  };

  const renderView = () => {
    if (isLoading) {
      return <Skeleton className="h-96 w-full" />;
    }

    if (isError) {
      return (
        <EmptyState
          variant="error"
          description={t("layout.loadError")}
          action={
            <Button variant="outline" size="sm" onClick={retry}>
              {t("layout.retry")}
            </Button>
          }
        />
      );
    }

    if (view === "plots") {
      return (
        <ExperimentLayoutPanel
          experimentId={experimentId}
          canEdit={canEdit}
          layout={layout ?? null}
          isDefining={isDefining}
          onDefiningChange={setIsDefining}
        />
      );
    }

    if (!hasPlots) {
      return <LayoutNeedsPlots view={view} canEdit={canEdit} onDefineLayout={defineLayout} />;
    }

    return view === "walking-order" ? walkingOrder : fieldDays;
  };

  // Scaffold only: `?legend=specimen` adds every look of the plot-state legend for C2's screen.
  const isLegendSpecimen = searchParams.get("legend") === "specimen";

  return (
    <div className="space-y-6">
      <LayoutViewSwitch view={view} onViewChange={showView} />
      {renderView()}
      {isLegendSpecimen ? <LayoutLegendSpecimen /> : null}
    </div>
  );
}
