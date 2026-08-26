"use client";

import { DeviceRow } from "@/components/iot-devices/device-row";
import { useLocale } from "@/hooks/useLocale";
import { X } from "lucide-react";

import type { ExperimentDevice } from "@repo/api/domains/experiment/devices/experiment-devices.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { IotDeviceStatusBadge } from "../../iot-devices/iot-device-status-badge";

interface ExperimentDeviceRowProps {
  binding: ExperimentDevice;
  onRequestDetach: (device: ExperimentDevice["device"]) => void;
}

/**
 * One binding on the experiment's Devices tab, on the shared row grammar: the
 * name resolves through the presenter and links to the device, and detaching
 * asks first instead of firing on a stray click.
 */
export function ExperimentDeviceRow({ binding, onRequestDetach }: ExperimentDeviceRowProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  return (
    <li>
      <DeviceRow
        device={binding.device}
        href={`/${locale}/platform/devices/${binding.device.id}`}
        status={<IotDeviceStatusBadge status={binding.device.status} />}
        trailing={
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("iot.experimentDevices.detach")}
            title={t("iot.experimentDevices.detach")}
            onClick={() => {
              onRequestDetach(binding.device);
            }}
          >
            <X className="size-4" />
          </Button>
        }
      />
    </li>
  );
}
