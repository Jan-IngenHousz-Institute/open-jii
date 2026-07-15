"use client";

import { useExperimentDeviceRemove } from "@/hooks/experiment/useExperimentDeviceRemove/useExperimentDeviceRemove";
import { useExperimentDevices } from "@/hooks/experiment/useExperimentDevices/useExperimentDevices";
import { Cpu } from "lucide-react";
import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExperimentDeviceRow } from "./experiment-device-row";

export function ExperimentDevicesPanel({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation("iot");

  const { data, isLoading, isError } = useExperimentDevices(experimentId);
  const bindings = useMemo(() => data?.body ?? [], [data]);

  const { mutate: detach } = useExperimentDeviceRemove({
    onSuccess: () => toast({ title: t("iot.experimentDevices.detachSuccess") }),
  });

  const handleDetach = (deviceId: string) => {
    detach(
      { params: { id: experimentId, deviceId } },
      {
        onError: () =>
          toast({ title: t("iot.experimentDevices.detachError"), variant: "destructive" }),
      },
    );
  };

  const renderRow = (binding: (typeof bindings)[number]) => (
    <ExperimentDeviceRow key={binding.device.id} binding={binding} onDetach={handleDetach} />
  );

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (isError) {
    return <p className="text-destructive text-sm">{t("iot.experimentDevices.loadError")}</p>;
  }

  if (bindings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10">
        <Cpu className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">{t("iot.experimentDevices.empty")}</p>
      </div>
    );
  }

  return <ul className="divide-y rounded-lg border">{bindings.map(renderRow)}</ul>;
}
