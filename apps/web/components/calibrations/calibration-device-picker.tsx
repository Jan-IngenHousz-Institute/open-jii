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

/** A trial produces a real run against a real device, which the author can then reject. */
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
      <div
        key={device.id}
        className="hover:bg-muted/40 flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors"
      >
        <RadioGroupItem value={device.id} id={inputId} className="mt-0.5" />
        {/* The shared label is a row; the name has to sit above the serial, not beside it. */}
        <Label
          htmlFor={inputId}
          className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 font-normal"
        >
          <span className="text-sm font-medium">{device.name}</span>
          <span className="text-muted-foreground font-mono text-xs">{device.serialNumber}</span>
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
