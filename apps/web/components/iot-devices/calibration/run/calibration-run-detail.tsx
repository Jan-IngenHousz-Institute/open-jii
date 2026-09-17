"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useCalibrationRun } from "@/hooks/iot/useCalibrationRun/useCalibrationRun";
import { useDeviceCalibrations } from "@/hooks/iot/useDeviceCalibrations/useDeviceCalibrations";
import { useLocale } from "@/hooks/useLocale";
import { ArrowLeft } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CalibrationBlockCard } from "../result/calibration-block-card";
import { CalibrationFitChart } from "../result/calibration-fit-chart";
import { CalibrationSeriesTable } from "../result/calibration-series-table";
import { fitLineFromBlocks, fitPointsFromPayload } from "../result/fit-points";
import { CalibrationRunStatusBadge } from "./calibration-run-status-badge";
import { CalibrationWriteRecord } from "./calibration-write-record";

interface CalibrationRunDetailProps {
  runId: string;
  deviceId: string;
  onBack: () => void;
}

/** A device info record holds whatever the family reported about itself. */
function formatInfoValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * One finished bench session, read back from the record. A calibration is only
 * defensible if the readings, the fit and the write outcome survive the session that
 * produced them, so everything stored about a run is on this page.
 */
export function CalibrationRunDetail({ runId, deviceId, onBack }: CalibrationRunDetailProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const { data: run, isLoading, isError } = useCalibrationRun(runId);
  const definition = useCalibrationDefinition(run?.definitionId ?? null);
  const calibrations = useDeviceCalibrations(deviceId);

  const applied = calibrations.data?.find((calibration) => calibration.runId === runId);
  const blocks = Object.entries(run?.blocks ?? {});
  const payload = Object.entries(run?.payload ?? {});
  const preInfo = Object.entries(run?.preInfo ?? {});
  const postInfo = Object.entries(run?.postInfo ?? {});
  const hasInfo = preInfo.length > 0 || postInfo.length > 0;

  function renderFact([label, value]: [string, string]) {
    return (
      <div key={label} className="contents">
        <dt className="text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
      </div>
    );
  }

  function renderBlock([name, block]: (typeof blocks)[number]) {
    return <CalibrationBlockCard key={name} name={name} block={block} previous={null} />;
  }

  function renderSeries([series, rows]: (typeof payload)[number]) {
    return <CalibrationSeriesTable key={series} series={series} rows={rows} />;
  }

  function renderInfoEntry([key, value]: (typeof preInfo)[number]) {
    return (
      <div key={key} className="contents">
        <dt className="text-muted-foreground">{key}</dt>
        <dd className="truncate font-mono text-xs">{formatInfoValue(value)}</dd>
      </div>
    );
  }

  function renderInfoSection(title: string, entries: typeof preInfo) {
    if (entries.length === 0) {
      return null;
    }
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {entries.map(renderInfoEntry)}
        </dl>
      </div>
    );
  }

  function renderChart() {
    if (run === undefined) {
      return null;
    }
    const line = fitLineFromBlocks(run.blocks);
    const points = fitPointsFromPayload(run.payload ?? {});
    if (line === null || points.length === 0) {
      return null;
    }
    return <CalibrationFitChart points={points} slope={line.slope} intercept={line.intercept} />;
  }

  function factsOf(session: NonNullable<typeof run>): [string, string][] {
    const facts: [string, string][] = [
      [
        t("iot.calibration.run.definition"),
        `${definition.data?.name ?? t("iot.calibration.run.definitionUnknown")} v${String(session.definitionVersion)}`,
      ],
      [t("iot.calibration.run.started"), new Date(session.createdAt).toLocaleString(locale)],
      [
        t("iot.calibration.run.source"),
        session.inputSource === "bench_wizard"
          ? t("iot.calibration.run.sourceWizard")
          : t("iot.calibration.run.sourceExternal"),
      ],
    ];

    if (session.finishedAt !== null) {
      facts.push([
        t("iot.calibration.run.finished"),
        new Date(session.finishedAt).toLocaleString(locale),
      ]);
    }
    if (session.reviewedAt !== null) {
      facts.push([
        t("iot.calibration.run.reviewed"),
        new Date(session.reviewedAt).toLocaleString(locale),
      ]);
    }
    if (session.firmwareVersion !== null) {
      facts.push([t("iot.calibration.run.firmware"), session.firmwareVersion]);
    }

    return facts;
  }

  function renderBody() {
    if (isLoading) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (isError || run === undefined) {
      return <EmptyState variant="error" description={t("iot.calibration.loadError")} />;
    }

    return (
      <div className="space-y-6">
        <PanelCard title={t("iot.calibration.run.title")}>
          <div className="space-y-4">
            <CalibrationRunStatusBadge status={run.status} />
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              {factsOf(run).map(renderFact)}
            </dl>
          </div>
        </PanelCard>

        {run.errorMessage !== null && (
          <Alert variant="destructive">
            <AlertDescription className="font-mono text-xs">{run.errorMessage}</AlertDescription>
          </Alert>
        )}

        {renderChart()}

        {blocks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">{blocks.map(renderBlock)}</div>
        )}

        {applied !== undefined && <CalibrationWriteRecord applied={applied} />}

        {hasInfo && (
          <PanelCard title={t("iot.calibration.run.deviceState")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderInfoSection(t("iot.calibration.run.infoBefore"), preInfo)}
              {renderInfoSection(t("iot.calibration.run.infoAfter"), postInfo)}
            </div>
          </PanelCard>
        )}

        {payload.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">{t("iot.calibration.run.readings")}</p>
            {payload.map(renderSeries)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="mr-2 size-4" aria-hidden />
        {t("iot.calibration.run.back")}
      </Button>
      {renderBody()}
    </div>
  );
}
