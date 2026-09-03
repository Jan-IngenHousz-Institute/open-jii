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

import { summarizeExperimentDevices } from "./experiment-devices-summary";
import { ExperimentDevicesTable } from "./experiment-devices-table";

export function ExperimentDevicesPanel({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  const { data, isLoading, isError, refetch } = useExperimentDevices(experimentId);

  const [detaching, setDetaching] = useState<ExperimentDeviceIdentity | null>(null);

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
    return <Skeleton className="h-16 w-full rounded-lg" />;
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

  return (
    <>
      <ExperimentDevicesStats overview={data} />

      {data.pipelineUnavailable && (
        <p className="text-status-stale-foreground flex items-center gap-1.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t("iot.experimentDevices.pipelineUnavailable")}
        </p>
      )}

      <ExperimentDevicesTable overview={data} onRequestDetach={setDetaching} />

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

function ExperimentDevicesStats({ overview }: { overview: ExperimentDevicesOverview }) {
  const { t } = useTranslation("iot");
  const summary = summarizeExperimentDevices(overview);

  // Warehouse facts unknown: the data-derived counts stay blank rather than
  // claiming silence from missing data.
  const dataValue = (value: number) =>
    overview.pipelineUnavailable ? t("iot.experimentDevices.lastDataUnavailable") : value;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={t("iot.experimentDevices.stats.onboarded")} className="bg-card">
        <p className="text-lg font-semibold">{summary.onboarded}</p>
      </Tile>
      <Tile label={t("iot.experimentDevices.stats.sending")} className="bg-card">
        <p className="text-lg font-semibold">{dataValue(summary.sending)}</p>
      </Tile>
      <Tile label={t("iot.experimentDevices.stats.silent")} className="bg-card">
        <p className="text-lg font-semibold">{dataValue(summary.onboardedSilent)}</p>
      </Tile>
      <Tile label={t("iot.experimentDevices.stats.unbound")} className="bg-card">
        <p className="text-lg font-semibold">{dataValue(summary.sendingUnbound)}</p>
      </Tile>
    </div>
  );
}
