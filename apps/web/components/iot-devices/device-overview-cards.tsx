"use client";

import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { StatusBadge } from "@/components/shared/status-badge";
import { useActiveDeviceCalibration } from "@/hooks/iot/useActiveDeviceCalibration/useActiveDeviceCalibration";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useDeviceFirmwareHistory } from "@/hooks/iot/useDeviceFirmwareHistory/useDeviceFirmwareHistory";
import { useDeviceObservedExperiments } from "@/hooks/iot/useDeviceObservedExperiments/useDeviceObservedExperiments";
import { useIotDeviceActivity } from "@/hooks/iot/useIotDeviceActivity/useIotDeviceActivity";
import { useIotFirmwareReleases } from "@/hooks/iot/useIotFirmwareReleases/useIotFirmwareReleases";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { formatRelativeTime } from "@/util/date";
import {
  hasManagedFirmware,
  isSameFirmwareVersion,
  latestReportedVersion,
} from "@/util/firmware-family";
import { useQuery } from "@tanstack/react-query";
import { Activity, Cpu, FlaskConical, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { zCalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { IotDeviceDetail, ObservedExperiment } from "@repo/api/domains/iot/iot.schema";
import { listItems } from "@repo/api/shared/listing";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { CardDescription } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

import { EntityLink } from "./monitoring/entity-link";
import { resolveEntities } from "./monitoring/resolve-entity-label";
import { OverviewCard } from "./overview-card";

const EXPERIMENT_LIST_CLASS = "-mx-6 -mb-3 mt-4 max-h-54 divide-y overflow-y-auto border-t";

interface DeviceOverviewCardsProps {
  device: IotDeviceDetail;
}

/**
 * The overview's stitched summary cards: what each neighbouring tab would say,
 * with a link into it. Non-phones read experiments from their bindings; phones
 * bind nowhere, so their card reads what the warehouse observed them feeding,
 * through the same fold the lineage uses.
 */
export function DeviceOverviewCards({ device }: DeviceOverviewCardsProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const isMobileFamily = device.deviceType === "mobile";
  const isManagedFirmware = hasManagedFirmware(device.deviceType);
  const isCalibrationFamily = zCalibrationFamily.safeParse(device.deviceType).success;

  const {
    data: boundData,
    isLoading: isLoadingBound,
    isError: isBoundError,
    refetch: refetchBound,
  } = useDeviceExperiments(device.id);
  const bound = boundData ?? [];

  const { data: activity } = useIotDeviceActivity(device.id);

  // A month covers a daily reporter for both warehouse-backed cards.
  const lookback = useMemo(() => resolveMonitoringPreset("last30d"), []);
  const { data: firmwareHistory, isLoading: isLoadingFirmware } = useDeviceFirmwareHistory(
    device.id,
    lookback,
    { enabled: isManagedFirmware },
  );

  // The verdict needs the release line; a version alone is just a string.
  // The guard call narrows inline where the derived boolean cannot.
  const { data: releasesData } = useIotFirmwareReleases(
    hasManagedFirmware(device.deviceType) ? device.deviceType : "ambyte",
    { enabled: isManagedFirmware },
  );

  const {
    data: observedData,
    isLoading: isLoadingObserved,
    isError: isObservedError,
    refetch: refetchObserved,
  } = useDeviceObservedExperiments(device.id, lookback, { enabled: isMobileFamily });
  const observed = observedData?.experiments ?? [];

  const { data: activeCalibration, isLoading: isLoadingCalibration } = useActiveDeviceCalibration(
    device.id,
    { enabled: isCalibrationFamily },
  );

  // Names for the viewer's own experiments; anything else stays opaque.
  const { data: visibleExperiments } = useQuery(
    orpc.experiments.listExperiments.queryOptions({
      input: { filter: "member" },
      enabled: isMobileFamily,
    }),
  );
  const observedEntities = resolveEntities(
    observed.flatMap((entry) => (entry.experimentId === null ? [] : [entry.experimentId])),
    listItems(visibleExperiments).map((experiment) => ({
      id: experiment.id,
      name: experiment.name,
    })),
    (id) => `/${locale}/platform/experiments/${id}`,
    (index) => t("iot.devices.monitoring.privateExperiment", { index }),
  );

  const basePath = `/${locale}/platform/devices/${device.id}`;

  function renderFigure(value: React.ReactNode, caption: string) {
    return (
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{caption}</p>
      </div>
    );
  }

  function renderBoundExperiment(experiment: (typeof bound)[number]) {
    return (
      <li
        key={experiment.id}
        className="hover:bg-muted/40 flex items-center gap-3 px-6 py-3 transition-colors"
      >
        <Link
          href={`/${locale}/platform/experiments/${experiment.id}`}
          className="focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 flex-1 truncate text-sm font-medium hover:underline focus-visible:ring-2"
        >
          {experiment.name}
        </Link>
      </li>
    );
  }

  function renderExperimentsBody() {
    if (isLoadingBound) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      );
    }
    if (isBoundError) {
      return (
        <EmptyState
          size="inline"
          variant="error"
          description={t("iot.devices.detail.cards.experimentsError")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchBound();
              }}
            >
              {t("iot.onboarding.retry")}
            </Button>
          }
        />
      );
    }
    if (bound.length === 0) {
      return (
        <EmptyState size="inline" description={t("iot.devices.detail.cards.experimentsEmpty")} />
      );
    }
    return (
      <>
        {renderFigure(bound.length, t("iot.devices.detail.cards.onboarded"))}
        <ul className={EXPERIMENT_LIST_CLASS}>{bound.map(renderBoundExperiment)}</ul>
      </>
    );
  }

  function renderObservedRow(entry: ObservedExperiment) {
    const entity = entry.experimentId === null ? null : observedEntities.get(entry.experimentId);

    return (
      <li
        key={entry.experimentId ?? "unattributed"}
        className="hover:bg-muted/40 flex items-center gap-3 px-6 py-3 transition-colors"
      >
        <span className="min-w-0 flex-1 truncate text-sm">
          {entity === null || entity === undefined ? (
            <span className="text-muted-foreground italic">
              {t("iot.devices.detail.cards.observedUnattributed")}
            </span>
          ) : (
            <EntityLink entity={entity} />
          )}
        </span>
        {entry.lastAt !== null && (
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatRelativeTime(entry.lastAt, locale)}
          </span>
        )}
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {t("iot.devices.detail.cards.measurementCount", { count: entry.count })}
        </span>
      </li>
    );
  }

  function renderObservedBody() {
    if (isLoadingObserved) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      );
    }
    if (isObservedError) {
      return (
        <EmptyState
          size="inline"
          variant="error"
          description={t("iot.devices.detail.cards.experimentsError")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchObserved();
              }}
            >
              {t("iot.onboarding.retry")}
            </Button>
          }
        />
      );
    }
    if (observed.length === 0) {
      return <EmptyState size="inline" description={t("iot.devices.detail.cards.observedEmpty")} />;
    }
    return (
      <div>
        <div className="grid grid-cols-2 gap-4">
          {renderFigure(observed.length, t("iot.devices.detail.cards.observedShortCaption"))}
          {renderFigure(
            lastDataRelative ?? "\u2014",
            t("iot.devices.detail.cards.activityFigureCaption"),
          )}
        </div>
        <ul className={EXPERIMENT_LIST_CLASS}>{observed.map(renderObservedRow)}</ul>
      </div>
    );
  }

  function activityLine(): string {
    if (activity === undefined) {
      return t("iot.devices.detail.cards.activityLoading");
    }
    if (activity.pipelineUnavailable) {
      return t("iot.devices.monitoring.lastDataUnavailable");
    }
    if (activity.lastDataAt === null) {
      return t("iot.devices.detail.cards.activityNoData");
    }
    return t("iot.devices.detail.cards.activityLastData", {
      time: formatRelativeTime(activity.lastDataAt, locale),
    });
  }

  const lastDataRelative =
    activity !== undefined && !activity.pipelineUnavailable && activity.lastDataAt !== null
      ? formatRelativeTime(activity.lastDataAt, locale)
      : null;

  // Just its one unique fact: the header's dot and the About sidebar already
  // carry connectivity and last-seen.
  function renderActivityBody() {
    return renderFigure(
      lastDataRelative ?? "\u2014",
      lastDataRelative === null
        ? activityLine()
        : t("iot.devices.detail.cards.activityFigureCaption"),
    );
  }

  function renderFirmwareBody() {
    if (isLoadingFirmware) {
      return <Skeleton className="h-5 w-40" />;
    }
    const reported = latestReportedVersion(firmwareHistory?.versions ?? []);
    if (reported === null) {
      return <CardDescription>{t("iot.devices.detail.cards.firmwareUnknown")}</CardDescription>;
    }
    const latest = (releasesData?.releases ?? []).find((release) => release.latest) ?? null;
    const isCurrent = latest !== null && isSameFirmwareVersion(reported, latest.version);

    return renderFigure(
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="font-mono">{reported}</span>
        {latest !== null &&
          (isCurrent ? (
            <StatusBadge tone="active">{t("iot.devices.firmware.upToDateShort")}</StatusBadge>
          ) : (
            <StatusBadge tone="stale">{t("iot.devices.firmware.updateAvailableShort")}</StatusBadge>
          ))}
      </span>,
      t("iot.devices.detail.cards.firmwareReportedCaption"),
    );
  }

  // How current the calibration is, with the worst block's write state beside it: a
  // coefficient the device never confirmed is the one fact that makes the date misleading.
  function renderCalibrationBody() {
    if (isLoadingCalibration) {
      return <Skeleton className="h-5 w-40" />;
    }
    const blocks = Object.values(activeCalibration?.blocks ?? {});
    if (blocks.length === 0) {
      return <CardDescription>{t("iot.devices.detail.cards.calibrationNone")}</CardDescription>;
    }
    // ISO timestamps order as text, so the newest block is the greatest string.
    const latestValidFrom = blocks.reduce(
      (latest, block) => (block.validFrom > latest ? block.validFrom : latest),
      "",
    );
    const isUnconfirmed = blocks.some((block) => block.writeResult?.verified === false);
    const isUnwritten = blocks.some((block) => block.writtenToDeviceAt === null);

    return renderFigure(
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>{formatRelativeTime(latestValidFrom, locale)}</span>
        {isUnconfirmed ? (
          <StatusBadge tone="destructive">{t("iot.calibration.active.unconfirmed")}</StatusBadge>
        ) : isUnwritten ? (
          <StatusBadge tone="stale">{t("iot.calibration.active.notWritten")}</StatusBadge>
        ) : (
          <StatusBadge tone="active">{t("iot.calibration.active.written")}</StatusBadge>
        )}
      </span>,
      t("iot.devices.detail.cards.calibrationCaption"),
    );
  }

  const rail = [
    !isMobileFamily && (
      <OverviewCard
        key="activity"
        icon={<Activity aria-hidden />}
        wellClassName="bg-chart-2/10 text-chart-2"
        title={t("iot.devices.detail.cards.activityTitle")}
        link={{
          href: `${basePath}/monitoring`,
          label: t("iot.devices.detail.cards.monitoringLink"),
        }}
      >
        {renderActivityBody()}
      </OverviewCard>
    ),
    isManagedFirmware && (
      <OverviewCard
        key="firmware"
        icon={<Cpu aria-hidden />}
        wellClassName="bg-muted text-foreground"
        title={t("iot.devices.detail.cards.firmwareTitle")}
        link={{ href: `${basePath}/firmware`, label: t("iot.devices.detail.cards.firmwareLink") }}
      >
        {renderFirmwareBody()}
      </OverviewCard>
    ),
    isCalibrationFamily && (
      <OverviewCard
        key="calibration"
        icon={<SlidersHorizontal aria-hidden />}
        wellClassName="bg-chart-3/10 text-chart-3"
        title={t("iot.devices.detail.cards.calibrationTitle")}
        link={{
          href: `${basePath}/calibration`,
          label: t("iot.devices.detail.cards.calibrationLink"),
        }}
      >
        {renderCalibrationBody()}
      </OverviewCard>
    ),
  ].filter(Boolean);

  // Main and rail: the experiments card carries a list, the others a figure, so
  // a plain two-column grid left the short ones stranded beside half a row.
  return (
    <div className={cn("grid items-start gap-4", rail.length > 0 && "xl:grid-cols-2")}>
      {!isMobileFamily && (
        <OverviewCard
          icon={<FlaskConical aria-hidden />}
          wellClassName="bg-primary/10 text-primary"
          title={t("iot.devices.detail.cards.experimentsTitle")}
          link={{
            href: `${basePath}/onboarding`,
            label: t("iot.devices.detail.cards.onboardLink"),
          }}
        >
          {renderExperimentsBody()}
        </OverviewCard>
      )}

      {isMobileFamily && (
        <OverviewCard
          icon={<FlaskConical aria-hidden />}
          wellClassName="bg-primary/10 text-primary"
          title={t("iot.devices.detail.cards.experimentsTitle")}
          link={{
            href: `${basePath}/monitoring`,
            label: t("iot.devices.detail.cards.monitoringLink"),
          }}
        >
          {renderObservedBody()}
        </OverviewCard>
      )}

      {rail.length > 0 && <div className="grid gap-4">{rail}</div>}
    </div>
  );
}
