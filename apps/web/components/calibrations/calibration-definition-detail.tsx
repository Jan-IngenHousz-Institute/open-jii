"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
import { getSensorFamilyBadgeTone } from "@/util/sensor-family";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CalibrationOutputBlocks } from "./calibration-output-blocks";
import { CalibrationProcedureSummary } from "./calibration-procedure-summary";

/** One bench procedure in full: the rig it needs, what it does, how it fits, what it produces. */
export function CalibrationDefinitionDetail() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ definitionId: string }>();

  const { data: definition, isLoading, isError } = useCalibrationDefinition(params.definitionId);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (isError || definition === undefined) {
    return <EmptyState variant="error" description={t("iot.calibration.loadError")} />;
  }

  const instruments = definition.captureProcedure.instruments;

  function renderFact([label, value]: [string, string]) {
    return (
      <div key={label} className="contents">
        <dt className="text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
      </div>
    );
  }

  function renderInstrument(instrument: (typeof instruments)[number]) {
    return (
      <div key={instrument.role} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono">{instrument.role}</span>
        <span className="text-muted-foreground text-xs">
          {"handshake" in instrument
            ? t("iot.calibration.detail.answers", { handshake: instrument.handshake })
            : t("iot.calibration.detail.theDevice")}
        </span>
      </div>
    );
  }

  const facts: [string, string][] = [
    [t("iot.calibration.detail.created"), new Date(definition.createdAt).toLocaleString(locale)],
  ];
  if (definition.minFirmwareVersion !== null) {
    facts.push([t("iot.calibration.detail.firmwareFloor"), definition.minFirmwareVersion]);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{definition.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={getSensorFamilyBadgeTone(definition.family)} className="capitalize">
            {definition.family}
          </StatusBadge>
          <VisibilityBadge visibility={definition.visibility} />
        </div>
        {definition.description !== null && (
          <p className="text-muted-foreground text-sm">{definition.description}</p>
        )}
      </div>

      <PanelCard title={t("iot.calibration.detail.rig")}>
        <div className="space-y-3">
          <div className="space-y-1">{instruments.map(renderInstrument)}</div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {facts.map(renderFact)}
          </dl>
        </div>
      </PanelCard>

      <PanelCard title={t("iot.calibration.detail.procedure")}>
        <CalibrationProcedureSummary procedure={definition.captureProcedure} />
      </PanelCard>

      <PanelCard title={t("iot.calibration.detail.produces")}>
        <CalibrationOutputBlocks
          family={definition.family}
          outputSchema={definition.outputSchema}
        />
      </PanelCard>

      <PanelCard title={t("iot.calibration.detail.script")}>
        <pre className="bg-muted/40 overflow-x-auto rounded-md p-3 font-mono text-xs">
          {definition.script}
        </pre>
      </PanelCard>
    </div>
  );
}
