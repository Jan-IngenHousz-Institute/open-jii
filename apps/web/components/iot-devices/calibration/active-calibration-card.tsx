"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLocale } from "@/hooks/useLocale";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

import type { ActiveDeviceCalibration } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { formatCoefficientValue } from "./format-coefficient-value";

interface ActiveCalibrationCardProps {
  calibration: ActiveDeviceCalibration | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

type ActiveBlock = ActiveDeviceCalibration["blocks"][string];

/**
 * What the device is running on, block by block. Each block names the session that set it,
 * because they need not have come from the same one: calibrating the PAR line again does
 * not disturb the spectral channels, and the record says so.
 */
export function ActiveCalibrationCard({
  calibration,
  isLoading,
  isError,
}: ActiveCalibrationCardProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const blocks = Object.entries(calibration?.blocks ?? {});

  function renderWriteState(block: ActiveBlock) {
    if (block.writtenToDeviceAt === null) {
      return (
        <StatusBadge tone="stale">
          <CircleDashed className="mr-1 size-3" aria-hidden />
          {t("iot.calibration.active.notWritten")}
        </StatusBadge>
      );
    }
    if (block.writeResult?.verified === false) {
      return (
        <StatusBadge tone="destructive">
          <AlertTriangle className="mr-1 size-3" aria-hidden />
          {t("iot.calibration.active.unconfirmed")}
        </StatusBadge>
      );
    }
    return (
      <StatusBadge tone="active">
        <CheckCircle2 className="mr-1 size-3" aria-hidden />
        {t("iot.calibration.active.written")}
      </StatusBadge>
    );
  }

  function renderCoefficient([name, value]: [string, number | number[]]) {
    return (
      <div key={name} className="contents">
        <dt className="text-muted-foreground">{name}</dt>
        <dd className="font-mono">{formatCoefficientValue(value)}</dd>
      </div>
    );
  }

  function renderBlock([name, block]: (typeof blocks)[number]) {
    return (
      <div key={name} className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{name}</p>
        <div className="flex flex-wrap items-center gap-2">
          {renderWriteState(block)}
          <span className="text-muted-foreground text-xs">
            {t("iot.calibration.active.validFrom", {
              date: new Date(block.validFrom).toLocaleString(locale),
            })}
          </span>
        </div>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(block.coefficients).map(renderCoefficient)}
        </dl>
      </div>
    );
  }

  function renderBody() {
    if (isLoading) {
      return <Skeleton className="h-24 w-full" />;
    }
    if (isError) {
      return (
        <EmptyState size="inline" variant="error" description={t("iot.calibration.loadError")} />
      );
    }
    if (blocks.length === 0) {
      return <EmptyState size="inline" description={t("iot.calibration.active.none")} />;
    }

    return <div className="space-y-4">{blocks.map(renderBlock)}</div>;
  }

  return <PanelCard title={t("iot.calibration.active.title")}>{renderBody()}</PanelCard>;
}
