"use client";

import { MetricStatCard } from "@/components/metrics/metric-stat-card";
import { metricsBandGrid } from "@/components/metrics/metrics-band-grid";
import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { useExperimentDeviceRemove } from "@/hooks/experiment/useExperimentDeviceRemove/useExperimentDeviceRemove";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Cpu, Loader2 } from "lucide-react";
import { useState } from "react";

import { summarizeExperimentDevices } from "@repo/api/domains/experiment/devices/experiment-devices-summary";
import type {
  ExperimentDeviceEntry,
  ExperimentDeviceIdentity,
  ExperimentDevicesOverview,
} from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExperimentDeviceDetail } from "./experiment-device-detail";
import { ExperimentDevicesList } from "./experiment-devices-list";
import { useExperimentDevicesList } from "./use-experiment-devices-list";

export function ExperimentDevicesPanel({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  const [detaching, setDetaching] = useState<ExperimentDeviceIdentity | null>(null);
  const [selection, setSelection] = useState<{
    experimentId: string;
    entry: ExperimentDeviceEntry;
  } | null>(null);
  const list = useExperimentDevicesList(experimentId);
  const data = list.response?.overview;
  const selected = selection?.experimentId === experimentId ? selection.entry : undefined;
  const onPage = data?.devices.find((entry) => entry.clientId === selected?.clientId);
  const offPage = useQuery(
    orpc.experiments.listExperimentDevices.queryOptions({
      input: {
        id: experimentId,
        page: 1,
        pageSize: 1,
        search: selected?.clientId,
        selectedClientId: selected?.clientId,
      },
      enabled: selected !== undefined && data !== undefined && !onPage,
      select: (overview) =>
        overview.devices.find((entry) => entry.clientId === selected?.clientId) ??
        overview.pagination?.selected ??
        null,
    }),
  );

  const { mutate: detach, isPending: isDetaching } = useExperimentDeviceRemove({
    onSuccess: () => {
      toast({ title: t("iot.experimentDevices.detachSuccess") });
    },
  });

  const confirmDetach = () => {
    if (detaching === null) {
      return;
    }
    detach(
      { id: experimentId, deviceId: detaching.id },
      {
        onError: () => {
          toast({ title: t("iot.experimentDevices.detachError"), variant: "destructive" });
        },
        onSettled: () => {
          setDetaching(null);
        },
      },
    );
  };

  if (list.isLoading) {
    return <ExperimentDevicesSkeleton />;
  }

  if (list.error || data === undefined) {
    return (
      <EmptyState
        variant="error"
        description={t("iot.experimentDevices.loadError")}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void list.refetch();
            }}
          >
            {t("iot.onboarding.retry")}
          </Button>
        }
      />
    );
  }

  if ((data.pagination?.summary.total ?? data.devices.length) === 0) {
    return (
      <EmptyState
        icon={<Cpu aria-hidden />}
        title={t("iot.experimentDevices.emptyTitle")}
        description={t("iot.experimentDevices.empty")}
        action={
          <Button variant="outline" asChild>
            <IntentLink href={`/${locale}/platform/devices`}>
              {t("iot.experimentDevices.openRegistry")}
            </IntentLink>
          </Button>
        }
      />
    );
  }

  const selectedEntry =
    onPage ?? (offPage.data === undefined ? selected : offPage.data) ?? data.devices.at(0);

  return (
    <>
      <ExperimentDevicesStats overview={data} />

      {data.pipelineUnavailable && (
        <p className="text-status-stale-foreground flex items-center gap-1.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t("iot.experimentDevices.pipelineUnavailable")}
        </p>
      )}

      {!onPage && offPage.isError && offPage.data === undefined && (
        <p className="text-status-stale-foreground flex items-center gap-1.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t("iot.experimentDevices.selectedLookupError")}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => {
              void offPage.refetch();
            }}
          >
            {t("iot.onboarding.retry")}
          </Button>
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ExperimentDevicesList
            list={list}
            selectedClientId={selectedEntry?.clientId ?? null}
            onSelect={(entry) => setSelection({ experimentId, entry })}
          />
        </div>

        {selectedEntry && (
          <ExperimentDeviceDetail
            experimentId={experimentId}
            entry={selectedEntry}
            window={data.window}
            pipelineUnavailable={data.pipelineUnavailable}
            onRequestDetach={setDetaching}
          />
        )}
      </div>

      <AlertDialog
        open={detaching !== null}
        onOpenChange={(open) => {
          if (!open && !isDetaching) {
            setDetaching(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("iot.experimentDevices.detachTitle", {
                name: detaching === null ? "" : resolveDeviceLabel(detaching, t),
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("iot.experimentDevices.detachConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDetaching}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDetaching}
              onClick={(e) => {
                e.preventDefault();
                confirmDetach();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDetaching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("iot.experimentDevices.detach")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExperimentDevicesSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-card space-y-2 rounded-lg border p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-border overflow-hidden rounded-lg border">
          <div className="p-3">
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="border-border divide-y border-t">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="size-2 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}

function ExperimentDevicesStats({ overview }: { overview: ExperimentDevicesOverview }) {
  const locale = useLocale();
  const { t } = useTranslation("iot");
  const summary = overview.pagination?.summary ?? summarizeExperimentDevices(overview.devices);

  // Warehouse facts unknown: the data-derived counts stay blank rather than
  // claiming silence from missing data.
  const dataValue = (value: number) =>
    overview.pipelineUnavailable ? t("iot.experimentDevices.lastDataUnavailable") : value;

  return (
    <div className={metricsBandGrid}>
      <MetricStatCard
        locale={locale}
        label={t("iot.experimentDevices.stats.onboarded")}
        value={summary.onboarded}
        note={t("iot.experimentDevices.stats.ofTotal", { count: summary.total })}
        className="bg-card"
      />

      <MetricStatCard
        locale={locale}
        label={t("iot.experimentDevices.stats.sending")}
        value={dataValue(summary.sending)}
        note={t("iot.experimentDevices.stats.window")}
        className="bg-card"
      />

      <MetricStatCard
        locale={locale}
        label={t("iot.experimentDevices.stats.silent")}
        value={dataValue(summary.onboardedSilent)}
        note={
          overview.pipelineUnavailable
            ? undefined
            : t("iot.experimentDevices.stats.ofOnboarded", { count: summary.onboarded })
        }
        className="bg-card"
      />

      <MetricStatCard
        locale={locale}
        label={t("iot.experimentDevices.stats.unbound")}
        value={dataValue(summary.sendingUnbound)}
        note={
          overview.pipelineUnavailable
            ? undefined
            : t("iot.experimentDevices.stats.ofSending", { count: summary.sending })
        }
        className="bg-card"
      />
    </div>
  );
}
