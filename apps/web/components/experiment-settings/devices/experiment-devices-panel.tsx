"use client";

import { useExperimentDeviceRemove } from "@/hooks/experiment/useExperimentDeviceRemove/useExperimentDeviceRemove";
import { useExperimentDevices } from "@/hooks/experiment/useExperimentDevices/useExperimentDevices";
import { Cpu, X } from "lucide-react";
import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { IotDeviceStatusBadge } from "../../iot-devices/iot-device-status-badge";

export function ExperimentDevicesPanel({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation("iot");

  const { data, isLoading } = useExperimentDevices(experimentId);
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

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (bindings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10">
        <Cpu className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">{t("iot.experimentDevices.empty")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {bindings.map((binding) => (
        <li key={binding.device.id} className="flex items-center gap-3 px-3 py-2.5">
          <Cpu className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {binding.device.name ?? binding.device.serialNumber}
            </p>
            <p className="text-muted-foreground truncate font-mono text-xs">
              {binding.device.serialNumber}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 capitalize">
            {binding.device.deviceType}
          </Badge>
          <IotDeviceStatusBadge status={binding.device.status} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("iot.experimentDevices.detach")}
            onClick={() => handleDetach(binding.device.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
