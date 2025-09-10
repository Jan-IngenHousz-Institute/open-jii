"use client";

import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import { Label, RadioGroup, RadioGroupItem } from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

export interface SensorFamily {
  id: "multispeq" | "ambyte";
  label: string;
  disabled: boolean;
  description?: string;
}

export const SENSOR_FAMILIES: SensorFamily[] = [
  {
    id: "multispeq",
    label: "MultispeQ",
    disabled: true,
    description: "uploadModal.sensorTypes.multispeq.description",
  },
  {
    id: "ambyte",
    label: "Ambyte",
    disabled: false,
    description: "uploadModal.sensorTypes.ambyte.description",
  },
];

const sensorCardVariants = cva(
  "flex items-start space-x-3 rounded-lg border p-4 transition-colors",
  {
    variants: {
      state: {
        available: "hover:bg-muted/50 cursor-pointer",
        disabled: "bg-muted/50 cursor-not-allowed opacity-50",
        selected: "border-primary bg-primary/10",
      },
    },
    defaultVariants: {
      state: "available",
    },
  },
);

interface SensorSelectionStepProps {
  selectedSensor: SensorFamily | null;
  onSensorSelect: (sensorId: string) => void;
}

export const SensorSelectionStep: React.FC<SensorSelectionStepProps> = ({
  selectedSensor,
  onSensorSelect,
}) => {
  const { t } = useTranslation("experiments");

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-medium">{t("uploadModal.sensorFamily.label")}</Label>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("uploadModal.sensorFamily.description")}
        </p>
      </div>

      <RadioGroup
        value={selectedSensor?.id ?? ""}
        onValueChange={onSensorSelect}
        className="space-y-3"
      >
        {SENSOR_FAMILIES.map((sensor) => (
          <div
            key={sensor.id}
            data-testid={`sensor-option-${sensor.id}`}
            className={sensorCardVariants({
              state: sensor.disabled ? "disabled" : "available",
            })}
            onClick={() => !sensor.disabled && onSensorSelect(sensor.id)}
          >
            <RadioGroupItem
              value={sensor.id}
              disabled={sensor.disabled}
              className="mt-0.5"
              aria-label={sensor.label}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label className="cursor-pointer font-medium">
                  {t(`uploadModal.sensorTypes.${sensor.id}.label`)}
                </Label>
                {sensor.disabled && (
                  <span className="bg-muted text-muted-foreground rounded px-2 py-1 text-xs">
                    {t("uploadModal.sensorTypes.multispeq.comingSoon")}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {t(`uploadModal.sensorTypes.${sensor.id}.description`)}
              </p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};
