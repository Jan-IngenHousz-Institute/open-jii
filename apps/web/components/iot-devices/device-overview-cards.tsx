"use client";

import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useDeviceFirmwareHistory } from "@/hooks/iot/useDeviceFirmwareHistory/useDeviceFirmwareHistory";
import { useDeviceObservedExperiments } from "@/hooks/iot/useDeviceObservedExperiments/useDeviceObservedExperiments";
import { useIotDeviceActivity } from "@/hooks/iot/useIotDeviceActivity/useIotDeviceActivity";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { formatRelativeTime } from "@/util/date";
import { hasManagedFirmware, latestReportedVersion } from "@/util/firmware-family";
import { useQuery } from "@tanstack/react-query";
import { Activity, Cpu, FlaskConical, KeyRound } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import type { IotDeviceDetail, ObservedExperiment } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { CardDescription } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ConnectivityDot, useFormatLastSeen } from "./device-connectivity";
import { IotDeviceStatusBadge } from "./iot-device-status-badge";
import { EntityLink } from "./monitoring/entity-link";
import { resolveEntities } from "./monitoring/resolve-entity-label";
import { OverviewCard } from "./overview-card";

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
  const formatLastSeen = useFormatLastSeen();

  const isMobileFamily = device.deviceType === "mobile";
  const isManagedFirmware = hasManagedFirmware(device.deviceType);

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

  const {
    data: observedData,
    isLoading: isLoadingObserved,
    isError: isObservedError,
    refetch: refetchObserved,
  } = useDeviceObservedExperiments(device.id, lookback, { enabled: isMobileFamily });
  const observed = observedData?.experiments ?? [];

  // Names for the viewer's own experiments; anything else stays opaque.
  const { data: visibleExperiments } = useQuery(
    orpc.experiments.listExperiments.queryOptions({
      input: { filter: "member" },
      enabled: isMobileFamily,
    }),
  );
  const observedEntities = resolveEntities(
    observed.flatMap((entry) => (entry.experimentId === null ? [] : [entry.experimentId])),
    (visibleExperiments ?? []).map((experiment) => ({
      id: experiment.id,
      name: experiment.name,
    })),
    (id) => `/${locale}/platform/experiments/${id}`,
    (index) => t("iot.devices.monitoring.privateExperiment", { index }),
  );

  const basePath = `/${locale}/platform/devices/${device.id}`;

  function renderBoundExperiment(experiment: (typeof bound)[number]) {
    return (
      <li
        key={experiment.id}
        className="hover:bg-muted/40 flex items-center gap-3 px-6 py-2.5 transition-colors"
      >
        <Link
          href={`/${locale}/platform/experiments/${experiment.id}`}
          className="focus-visible:ring-primary/40 focus-visible:outline-hidden min-w-0 flex-1 truncate text-sm font-medium hover:underline focus-visible:ring-2"
        >
          {experiment.name}
        </Link>
        <Badge variant="secondary" className="shrink-0">
          {t("iot.devices.detail.cards.onboarded")}
        </Badge>
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
    return <ul className="-mx-6 -mb-3 divide-y">{bound.map(renderBoundExperiment)}</ul>;
  }

  function renderObservedRow(entry: ObservedExperiment) {
    const entity = entry.experimentId === null ? null : observedEntities.get(entry.experimentId);

    return (
      <li
        key={entry.experimentId ?? "unattributed"}
        className="hover:bg-muted/40 flex items-center gap-3 px-6 py-2.5 transition-colors"
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
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {entry.count.toLocaleString(locale)}
        </Badge>
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
      <div className="space-y-2">
        <CardDescription>{t("iot.devices.detail.cards.observedHint")}</CardDescription>
        <ul className="-mx-6 -mb-3 divide-y">{observed.map(renderObservedRow)}</ul>
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

  function renderActivityBody() {
    return (
      <div className="space-y-2">
        <ConnectivityDot connectivity={device.connectivity} />
        <CardDescription>{formatLastSeen(device.connectivity)}</CardDescription>
        <CardDescription>{activityLine()}</CardDescription>
      </div>
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
    return (
      <div className="space-y-2">
        <span className="bg-muted inline-flex rounded-md px-2 py-1 font-mono text-sm">
          {reported}
        </span>
        <CardDescription>{t("iot.devices.detail.cards.firmwareReportedCaption")}</CardDescription>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {!isMobileFamily && (
        <OverviewCard
          icon={<KeyRound aria-hidden />}
          title={t("iot.devices.detail.cards.credentialsTitle")}
          link={
            device.capabilities.canManage
              ? { href: `${basePath}/credentials`, label: t("iot.devices.detail.cards.manageLink") }
              : undefined
          }
        >
          <div className="space-y-2">
            <IotDeviceStatusBadge status={device.status} />
            <CardDescription>
              {t(`iot.devices.detail.cards.credentialHint.${device.status}`)}
            </CardDescription>
            {device.certificateId !== null && (
              <p className="text-muted-foreground truncate font-mono text-xs">
                {device.certificateId}
              </p>
            )}
          </div>
        </OverviewCard>
      )}

      {!isMobileFamily && (
        <OverviewCard
          icon={<FlaskConical aria-hidden />}
          title={t("iot.devices.detail.cards.experimentsTitle")}
          titleExtra={
            bound.length > 0 ? <Badge variant="secondary">{bound.length}</Badge> : undefined
          }
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
          title={t("iot.devices.detail.cards.experimentsTitle")}
          titleExtra={
            observed.length > 0 ? <Badge variant="secondary">{observed.length}</Badge> : undefined
          }
          link={{
            href: `${basePath}/monitoring`,
            label: t("iot.devices.detail.cards.monitoringLink"),
          }}
        >
          {renderObservedBody()}
        </OverviewCard>
      )}

      <OverviewCard
        icon={<Activity aria-hidden />}
        title={t("iot.devices.detail.cards.activityTitle")}
        link={{
          href: `${basePath}/monitoring`,
          label: t("iot.devices.detail.cards.monitoringLink"),
        }}
      >
        {renderActivityBody()}
      </OverviewCard>

      {isManagedFirmware && (
        <OverviewCard
          icon={<Cpu aria-hidden />}
          title={t("iot.devices.detail.cards.firmwareTitle")}
          link={{ href: `${basePath}/firmware`, label: t("iot.devices.detail.cards.firmwareLink") }}
        >
          {renderFirmwareBody()}
        </OverviewCard>
      )}
    </div>
  );
}
