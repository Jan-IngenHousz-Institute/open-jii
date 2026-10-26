"use client";

import { useExperimentDeviceSensors } from "@/hooks/experiment/useExperimentDeviceSensors/useExperimentDeviceSensors";
import { useExperimentLayout } from "@/hooks/experiment/useExperimentLayout/useExperimentLayout";
import { useExperimentLayoutPlacements } from "@/hooks/experiment/useExperimentLayoutPlacements/useExperimentLayoutPlacements";
import { formatDate } from "@/util/date";
import { MapPin, Move, Trash2 } from "lucide-react";

import type { LayoutPlacement } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface ExperimentDevicePlacementsProps {
  experimentId: string;
  deviceId: string;
}

/** Where a fixed sensor stands and has stood, newest first, with Move and Remove on open ones. */
export function ExperimentDevicePlacements({
  experimentId,
  deviceId,
}: ExperimentDevicePlacementsProps) {
  const { t } = useTranslation("experiments");
  const { data: placements = [] } = useExperimentLayoutPlacements(experimentId, { deviceId });
  const { data: layout } = useExperimentLayout(experimentId);
  const { data: sensors = [] } = useExperimentDeviceSensors(experimentId, deviceId);

  if (placements.length === 0) {
    return null;
  }

  const plotName = (plotId: string) =>
    layout?.units.find((unit) => unit.id === plotId)?.identifier ?? plotId;
  const ordered = [...placements].sort((a, b) => {
    const isOpenFirst = Number(a.endDate !== null) - Number(b.endDate !== null);
    return isOpenFirst === 0 ? b.startDate.localeCompare(a.startDate) : isOpenFirst;
  });

  const renderPlacement = (placement: LayoutPlacement) => {
    const isOpen = placement.endDate === null;
    const sensor = sensors.find((candidate) => candidate.sensorId === placement.sensorId);
    const placed =
      placement.sensorId === null
        ? t("layout.placement.wholeDevice")
        : (sensor?.label ?? placement.sensorId);
    const period = isOpen
      ? t("layout.placement.since", { date: formatDate(placement.startDate) })
      : t("layout.placement.between", {
          start: formatDate(placement.startDate),
          end: formatDate(placement.endDate ?? placement.startDate),
        });

    return (
      <li
        key={placement.id}
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <MapPin
            className={
              isOpen ? "text-primary size-4 shrink-0" : "text-muted-foreground size-4 shrink-0"
            }
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t("layout.placement.onPlot", {
                sensor: placed,
                level: layout?.levelName ?? t("layout.defaultUnitName"),
                plot: plotName(placement.plotId),
              })}
            </p>
            <p className="text-muted-foreground text-xs">{period}</p>
          </div>
        </div>
        {isOpen ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Move className="size-4" aria-hidden />
              {t("layout.placement.move")}
            </Button>
            <Button variant="outline" size="sm">
              <Trash2 className="size-4" aria-hidden />
              {t("layout.placement.remove")}
            </Button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section className="space-y-2" data-device-placements>
      <div>
        <h4 className="text-sm font-medium">{t("layout.placement.listTitle")}</h4>
        <p className="text-muted-foreground text-xs">{t("layout.placement.listDescription")}</p>
      </div>
      <ul className="divide-y rounded-lg border">{ordered.map(renderPlacement)}</ul>
    </section>
  );
}
