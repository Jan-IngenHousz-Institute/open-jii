"use client";

import { useExperimentLayoutPlot } from "@/hooks/experiment/useExperimentLayoutPlot/useExperimentLayoutPlot";
import { Grid2x2X, MapPin, Move, PencilLine, X } from "lucide-react";

import type { PlotAttribute } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { LayoutPlotAttribute } from "./layout-plot-attribute";
import { rowLetter } from "./row-letter";

interface LayoutPlotPanelProps {
  experimentId: string;
  plotId: string;
  /** Shows the plot's actions, which only an experiment's admins and members take. */
  canEdit: boolean;
  onClose: () => void;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate text-sm">{value}</dd>
    </div>
  );
}

export function LayoutPlotPanel({ experimentId, plotId, canEdit, onClose }: LayoutPlotPanelProps) {
  const { t } = useTranslation("experiments");
  const { data: plot, isError, refetch } = useExperimentLayoutPlot(experimentId, plotId);

  const retry = () => {
    void refetch();
  };

  if (isError) {
    return (
      <EmptyState
        variant="error"
        description={t("layout.plot.loadError")}
        action={
          <Button variant="outline" size="sm" onClick={retry}>
            {t("layout.retry")}
          </Button>
        }
      />
    );
  }

  if (plot === undefined) {
    return <Skeleton className="h-72 w-full rounded-xl" />;
  }

  const { unit } = plot;
  const position =
    unit.row !== null && unit.column !== null
      ? { row: rowLetter(unit.row), column: String(unit.column) }
      : null;
  const hasAttributes = plot.attributes.length > 0;
  const isUnplaced = position === null;

  const renderAttribute = (attribute: PlotAttribute) => (
    <LayoutPlotAttribute key={attribute.name} attribute={attribute} canEdit={canEdit} />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("layout.plot.title", { level: plot.levelName, identifier: unit.identifier })}
        </CardTitle>
        <CardDescription>{t("layout.plot.description")}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon" aria-label={t("layout.plot.close")} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-6">
        {canEdit ? (
          <div className="flex flex-wrap gap-2" data-plot-actions>
            <Button variant="outline" size="sm">
              <PencilLine className="size-4" aria-hidden />
              {t("layout.plot.rename")}
            </Button>
            <Button variant={isUnplaced ? "default" : "outline"} size="sm">
              <Move className="size-4" aria-hidden />
              {t("layout.plot.setPosition")}
            </Button>
            <Button variant="outline" size="sm">
              <Grid2x2X className="size-4" aria-hidden />
              {t("layout.plot.markGap")}
            </Button>
            <Button variant="outline" size="sm" data-place-sensor>
              <MapPin className="size-4" aria-hidden />
              {t("layout.plot.placeSensor")}
            </Button>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {position === null ? (
            <Fact label={t("layout.plot.position")} value={t("layout.plot.noPosition")} />
          ) : (
            <>
              <Fact label={t("layout.plot.row")} value={position.row} />
              <Fact label={t("layout.plot.column")} value={position.column} />
            </>
          )}
        </dl>

        {hasAttributes ? (
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium">{t("layout.plot.attributes")}</h4>
            <dl className="space-y-4">{plot.attributes.map(renderAttribute)}</dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
