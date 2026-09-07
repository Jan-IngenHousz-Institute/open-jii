"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLocale } from "@/hooks/useLocale";
import { CheckCircle2, CircleDashed } from "lucide-react";

import type { DeviceCalibration } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { formatCoefficientValue } from "./format-coefficient-value";

interface ActiveCalibrationCardProps {
  calibration: DeviceCalibration | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** The coefficients in force on this device, and whether they reached it. */
export function ActiveCalibrationCard({
  calibration,
  isLoading,
  isError,
}: ActiveCalibrationCardProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const isWritten = calibration?.writtenToDeviceAt !== null;

  function renderBlocks(active: DeviceCalibration) {
    return Object.entries(active.blocks).map(([block, { coefficients }]) => (
      <div key={block} className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{block}</p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(coefficients).map(([name, value]) => (
            <div key={name} className="contents">
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="font-mono">{formatCoefficientValue(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    ));
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
    if (!calibration) {
      return <EmptyState size="inline" description={t("iot.calibration.active.none")} />;
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isWritten ? (
            <StatusBadge tone="active">
              <CheckCircle2 className="mr-1 size-3" aria-hidden />
              {t("iot.calibration.active.written")}
            </StatusBadge>
          ) : (
            <StatusBadge tone="stale">
              <CircleDashed className="mr-1 size-3" aria-hidden />
              {t("iot.calibration.active.notWritten")}
            </StatusBadge>
          )}
          <span className="text-muted-foreground text-xs">
            {t("iot.calibration.active.validFrom", {
              date: new Date(calibration.validFrom).toLocaleString(locale),
            })}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{renderBlocks(calibration)}</div>
      </div>
    );
  }

  return <PanelCard title={t("iot.calibration.active.title")}>{renderBody()}</PanelCard>;
}
