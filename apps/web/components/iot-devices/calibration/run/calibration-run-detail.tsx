"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useApproveCalibrationRun } from "@/hooks/iot/useApproveCalibrationRun/useApproveCalibrationRun";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useCalibrationRun } from "@/hooks/iot/useCalibrationRun/useCalibrationRun";
import { useDeviceCalibrations } from "@/hooks/iot/useDeviceCalibrations/useDeviceCalibrations";
import { useRejectCalibrationRun } from "@/hooks/iot/useRejectCalibrationRun/useRejectCalibrationRun";
import { useLocale } from "@/hooks/useLocale";
import { ChevronLeft, Loader2, SkipForward } from "lucide-react";

import type { SkippedSeriesList } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { CalibrationBlockCard } from "../result/calibration-block-card";
import { CalibrationSeriesTable } from "../result/calibration-series-table";
import type { CalibrationWriteSession } from "../wizard/calibration-wizard";
import { CalibrationRunStatusBadge } from "./calibration-run-status-badge";
import { CalibrationWriteRecord } from "./calibration-write-record";

interface CalibrationRunDetailProps {
  runId: string;
  deviceId: string;
  /** Deciding a run and writing it to hardware both need device manage rights. */
  canManage: boolean;
  onBack: () => void;
  /** Absent where the family has no writer, which the wizard says for itself. */
  onWriteToDevice?: (session: CalibrationWriteSession) => void;
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
 * produced them, so everything stored about a run is on this page. The decision is here
 * too: a run left computed when the tab closed is otherwise stuck for good.
 */
export function CalibrationRunDetail({
  runId,
  deviceId,
  canManage,
  onBack,
  onWriteToDevice,
}: CalibrationRunDetailProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const { data: run, isLoading, isError } = useCalibrationRun(runId);
  const definition = useCalibrationDefinition(run?.definitionId ?? null);
  const calibrations = useDeviceCalibrations(deviceId);
  const approveRun = useApproveCalibrationRun();
  const rejectRun = useRejectCalibrationRun();

  const applied = calibrations.data?.find((calibration) => calibration.runId === runId);
  const blocks = Object.entries(run?.blocks ?? {});
  const payload = Object.entries(run?.payload ?? {});
  const preInfo = Object.entries(run?.preInfo ?? {});
  const postInfo = Object.entries(run?.postInfo ?? {});
  const hasInfo = preInfo.length > 0 || postInfo.length > 0;
  const skipped: SkippedSeriesList = run?.skippedSeries ?? [];
  const isDeciding = approveRun.isPending || rejectRun.isPending;
  const isUndecided = run?.status === "computed";
  const isUnwritten = applied?.writtenToDeviceAt === null;

  async function approve() {
    try {
      await approveRun.mutateAsync({ runId });
    } catch {
      toast({ title: t("iot.calibration.review.approveFailed"), variant: "destructive" });
    }
  }

  async function reject() {
    try {
      await rejectRun.mutateAsync({ runId });
    } catch {
      toast({ title: t("iot.calibration.review.rejectFailed"), variant: "destructive" });
    }
  }

  function writeToDevice() {
    if (applied === undefined || run === undefined) return;
    onWriteToDevice?.({ calibration: applied, definitionId: run.definitionId });
  }

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

  function renderSkipped(entry: SkippedSeriesList[number]) {
    return (
      <li key={entry.series} className="text-muted-foreground flex items-start gap-2 text-sm">
        <SkipForward className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {t("iot.calibration.capture.skipped", { series: entry.series, reason: entry.reason })}
        </span>
      </li>
    );
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

  // A run carries at most one invitation: decide it, or carry what was decided to the
  // hardware it never reached.
  function renderRecordAction() {
    if (!canManage) {
      return undefined;
    }
    if (isUndecided) {
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reject()}
            disabled={isDeciding}
          >
            {rejectRun.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t("iot.calibration.review.reject")}
          </Button>
          <Button type="button" size="sm" onClick={() => void approve()} disabled={isDeciding}>
            {approveRun.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t("iot.calibration.review.approve")}
          </Button>
        </div>
      );
    }
    if (isUnwritten && onWriteToDevice !== undefined) {
      return (
        <Button type="button" size="sm" onClick={writeToDevice}>
          {t("iot.calibration.run.writeToDevice")}
        </Button>
      );
    }
    return undefined;
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
        <PanelCard title={t("iot.calibration.run.title")} action={renderRecordAction()}>
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

        {blocks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">{blocks.map(renderBlock)}</div>
        )}

        {applied !== undefined && <CalibrationWriteRecord applied={applied} />}

        {/* A series missing from the readings says nothing about whether that was the plan. */}
        {skipped.length > 0 && (
          <PanelCard title={t("iot.calibration.run.skippedTitle")}>
            <ul className="space-y-1.5">{skipped.map(renderSkipped)}</ul>
          </PanelCard>
        )}

        {hasInfo && (
          <PanelCard title={t("iot.calibration.run.deviceState")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderInfoSection(t("iot.calibration.run.infoBefore"), preInfo)}
              {renderInfoSection(t("iot.calibration.run.infoAfter"), postInfo)}
            </div>
          </PanelCard>
        )}

        {payload.length > 0 && (
          <PanelCard title={t("iot.calibration.run.readings")}>
            <div className="space-y-4">{payload.map(renderSeries)}</div>
          </PanelCard>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("iot.calibration.run.back")}
      </button>
      {renderBody()}
    </div>
  );
}
