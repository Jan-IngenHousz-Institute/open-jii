"use client";

import { useExperimentDeviceRemove } from "@/hooks/experiment/useExperimentDeviceRemove/useExperimentDeviceRemove";
import { useExperimentDevices } from "@/hooks/experiment/useExperimentDevices/useExperimentDevices";
import { useLocale } from "@/hooks/useLocale";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { Cpu, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { ExperimentDevice } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
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

import { ExperimentDeviceRow } from "./experiment-device-row";

export function ExperimentDevicesPanel({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  const { data, isLoading, isError, refetch } = useExperimentDevices(experimentId);
  const bindings = useMemo(() => data ?? [], [data]);

  const [detaching, setDetaching] = useState<ExperimentDevice["device"] | null>(null);

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

  const renderRow = (binding: ExperimentDevice) => (
    <ExperimentDeviceRow key={binding.device.id} binding={binding} onRequestDetach={setDetaching} />
  );

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-lg" />;
  }

  if (isError) {
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

  if (bindings.length === 0) {
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
      <ul className="divide-y rounded-lg border">{bindings.map(renderRow)}</ul>

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
