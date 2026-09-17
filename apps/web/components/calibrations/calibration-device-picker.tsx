"use client";

import type { IotDevice } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { Skeleton } from "@repo/ui/components/skeleton";

interface CalibrationDevicePickerProps {
  devices: IotDevice[] | undefined;
  isLoading: boolean;
  isError: boolean;
  selectedId: string | null;
  onSelect: (deviceId: string) => void;
}

/**
 * Which device this procedure is about to be tried on.
 *
 * A bench session is always a record against one device, so trying a procedure out is not
 * a dry run in the sense of touching nothing: it produces a run like any other, which the
 * author can then reject. Saying which device up front is what makes that honest.
 */
export function CalibrationDevicePicker({
  devices,
  isLoading,
  isError,
  selectedId,
  onSelect,
}: CalibrationDevicePickerProps) {
  const { t } = useTranslation("iot");

  function renderDevice(device: IotDevice) {
    const inputId = `calibration-device-${device.id}`;
    return (
      <div key={device.id} className="flex items-start gap-3 rounded-md border p-3">
        <RadioGroupItem value={device.id} id={inputId} className="mt-1" />
        <Label htmlFor={inputId} className="flex-1 cursor-pointer space-y-1 font-normal">
          <span className="block text-sm font-medium">{device.name}</span>
          <span className="text-muted-foreground block font-mono text-xs">
            {device.serialNumber}
          </span>
        </Label>
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (isError) {
    return (
      <EmptyState size="inline" variant="error" description={t("iot.calibration.loadError")} />
    );
  }
  if (!devices || devices.length === 0) {
    return <EmptyState size="inline" description={t("iot.calibration.trial.noDevices")} />;
  }

  return (
    <RadioGroup value={selectedId ?? ""} onValueChange={onSelect} className="space-y-2">
      {devices.map(renderDevice)}
    </RadioGroup>
  );
}
