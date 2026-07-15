"use client";

import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Cpu, X } from "lucide-react";

import type { ExperimentDevice } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import { IotDeviceStatusBadge } from "../../iot-devices/iot-device-status-badge";

interface ExperimentDeviceRowProps {
  binding: ExperimentDevice;
  onDetach: (deviceId: string) => void;
}

export function ExperimentDeviceRow({ binding, onDetach }: ExperimentDeviceRowProps) {
  const { t } = useTranslation("iot");

  const handleDetachClick = () => {
    onDetach(binding.device.id);
  };

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Cpu className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {binding.device.name ?? binding.device.serialNumber}
        </p>
        <p className="text-muted-foreground truncate font-mono text-xs">
          {binding.device.serialNumber}
        </p>
      </div>
      <Badge variant="outline" className="shrink-0">
        {getSensorFamilyLabel(binding.device.deviceType)}
      </Badge>
      <IotDeviceStatusBadge status={binding.device.status} />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label={t("iot.experimentDevices.detach")}
        onClick={handleDetachClick}
      >
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}
