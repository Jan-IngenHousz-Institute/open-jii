"use client";

import { useExperimentLayoutPlot } from "@/hooks/experiment/useExperimentLayoutPlot/useExperimentLayoutPlot";
import { X } from "lucide-react";

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
import { Skeleton } from "@repo/ui/components/skeleton";

import { LayoutPlotAttribute } from "./layout-plot-attribute";
import { rowLetter } from "./row-letter";

interface LayoutPlotPanelProps {
  experimentId: string;
  plotId: string;
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

export function LayoutPlotPanel({ experimentId, plotId, onClose }: LayoutPlotPanelProps) {
  const { t } = useTranslation("experiments");
  const { data: plot } = useExperimentLayoutPlot(experimentId, plotId);

  if (plot === undefined) {
    return <Skeleton className="h-72 w-full rounded-xl" />;
  }

  const { unit } = plot;
  const position =
    unit.row !== null && unit.column !== null
      ? { row: rowLetter(unit.row), column: String(unit.column) }
      : null;
  const hasAttributes = plot.attributes.length > 0;

  const renderAttribute = (attribute: PlotAttribute) => (
    <LayoutPlotAttribute key={attribute.name} attribute={attribute} />
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
        <dl className="grid grid-cols-3 gap-x-4 gap-y-3">
          <Fact label={t("layout.levelName")} value={plot.levelName} />
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
