"use client";

import { Tile } from "@/components/iot-devices/monitoring/tile";
import { useExperimentDeviceRemove } from "@/hooks/experiment/useExperimentDeviceRemove/useExperimentDeviceRemove";
import { useExperimentDevices } from "@/hooks/experiment/useExperimentDevices/useExperimentDevices";
import { useLocale } from "@/hooks/useLocale";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { AlertTriangle, Cpu, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
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
import { summarizeExperimentDevices } from "./experiment-devices-summary";

export function ExperimentDevicesPanel({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  const { data, isLoading, isError, refetch } = useExperimentDevices(experimentId);

  const [detaching, setDetaching] = useState<ExperimentDeviceIdentity | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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

  if (isLoading) {
    return <ExperimentDevicesSkeleton />;
  }

  if (isError || data === undefined) {
    return (
      <EmptyState
        variant="error"
        description={t("iot.experimentDevices.loadError")}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetch();
            }}
          >
            {t("iot.onboarding.retry")}
          </Button>
        }
      />
    );
  }

  if (data.devices.length === 0) {
    return (
      <EmptyState
        icon={<Cpu aria-hidden />}
        title={t("iot.experimentDevices.emptyTitle")}
        description={t("iot.experimentDevices.empty")}
        action={
          <Button variant="outline" asChild>
            <Link href={`/${locale}/platform/devices`}>
              {t("iot.experimentDevices.openRegistry")}
            </Link>
          </Button>
        }
      />
    );
  }

  // Derived each render so a refetch cannot leave the pane on a stale entry.
  const selectedEntry =
    data.devices.find((entry) => entry.clientId === selectedClientId) ?? data.devices[0];

  return (
    <>
      <ExperimentDevicesStats overview={data} />

      {data.pipelineUnavailable && (
        <p className="text-status-stale-foreground flex items-center gap-1.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t("iot.experimentDevices.pipelineUnavailable")}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ExperimentDevicesList
            devices={data.devices}
            selectedClientId={selectedEntry.clientId}
            onSelect={setSelectedClientId}
          />
        </div>

        <ExperimentDeviceDetail
          experimentId={experimentId}
          entry={selectedEntry}
          window={data.window}
          pipelineUnavailable={data.pipelineUnavailable}
          onRequestDetach={setDetaching}
        />
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
  const { t } = useTranslation("iot");
  const summary = summarizeExperimentDevices(overview);

  // Warehouse facts unknown: the data-derived counts stay blank rather than
  // claiming silence from missing data.
  const dataValue = (value: number) =>
    overview.pipelineUnavailable ? t("iot.experimentDevices.lastDataUnavailable") : value;

  const total = overview.devices.length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={t("iot.experimentDevices.stats.onboarded")} className="bg-card">
        <p className="text-lg font-semibold">{summary.onboarded}</p>
        <p className="text-muted-foreground text-xs font-normal">
          {t("iot.experimentDevices.stats.ofTotal", { count: total })}
        </p>
      </Tile>

      <Tile label={t("iot.experimentDevices.stats.sending")} className="bg-card">
        <p className="text-lg font-semibold">{dataValue(summary.sending)}</p>
        <p className="text-muted-foreground text-xs font-normal">
          {t("iot.experimentDevices.stats.window")}
        </p>
      </Tile>

      <Tile label={t("iot.experimentDevices.stats.silent")} className="bg-card">
        <p className="text-lg font-semibold">{dataValue(summary.onboardedSilent)}</p>
        {!overview.pipelineUnavailable && (
          <p className="text-muted-foreground text-xs font-normal">
            {t("iot.experimentDevices.stats.ofOnboarded", { count: summary.onboarded })}
          </p>
        )}
      </Tile>

      <Tile label={t("iot.experimentDevices.stats.unbound")} className="bg-card">
        <p className="text-lg font-semibold">{dataValue(summary.sendingUnbound)}</p>
        {!overview.pipelineUnavailable && (
          <p className="text-muted-foreground text-xs font-normal">
            {t("iot.experimentDevices.stats.ofSending", { count: summary.sending })}
          </p>
        )}
      </Tile>
    </div>
  );
}
