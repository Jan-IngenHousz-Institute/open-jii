"use client";

import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import { Label, RadioGroup, RadioGroupItem, Separator } from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";
import { Database, FileSpreadsheet } from "lucide-react";

export interface DataOption {
  id: "multispeq" | "ambyte" | "metadata";
  labelKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  disabled?: boolean;
  category: "sensor" | "metadata";
}

export const DATA_OPTIONS: DataOption[] = [
  // Sensor data options
  {
    id: "multispeq",
    labelKey: "uploadModal.options.multispeq.label",
    descriptionKey: "uploadModal.options.multispeq.description",
    icon: <Database className="h-5 w-5" />,
    disabled: true,
    category: "sensor",
  },
  {
    id: "ambyte",
    labelKey: "uploadModal.options.ambyte.label",
    descriptionKey: "uploadModal.options.ambyte.description",
    icon: <Database className="h-5 w-5" />,
    disabled: false,
    category: "sensor",
  },
  // Metadata option
  {
    id: "metadata",
    labelKey: "uploadModal.options.metadata.label",
    descriptionKey: "uploadModal.options.metadata.description",
    icon: <FileSpreadsheet className="h-5 w-5" />,
    disabled: false,
    category: "metadata",
  },
];

const optionCardVariants = cva(
  "flex items-start space-x-3 rounded-lg border p-4 transition-colors",
  {
    variants: {
      state: {
        available: "hover:bg-muted/50 cursor-pointer",
        disabled: "bg-muted/30 cursor-not-allowed opacity-60",
        selected: "border-primary bg-primary/10",
      },
    },
    defaultVariants: {
      state: "available",
    },
  }
);

interface DataSelectionStepProps {
  selectedOption: DataOption | null;
  onOptionSelect: (option: DataOption) => void;
}

export const DataSelectionStep: React.FC<DataSelectionStepProps> = ({
  selectedOption,
  onOptionSelect,
}) => {
  const { t } = useTranslation("experiments");

  const sensorOptions = DATA_OPTIONS.filter((o) => o.category === "sensor");
  const metadataOptions = DATA_OPTIONS.filter((o) => o.category === "metadata");

  const handleSelect = (optionId: string) => {
    const option = DATA_OPTIONS.find((o) => o.id === optionId);
    if (option && !option.disabled) {
      onOptionSelect(option);
    }
  };

  return (
    <div className="space-y-6">
      <RadioGroup
        value={selectedOption?.id ?? ""}
        onValueChange={handleSelect}
        className="space-y-6"
      >
        {/* Sensor Data Section */}
        <div className="space-y-3">
          <div>
            <Label className="text-base font-medium">
              {t("uploadModal.sections.sensorData")}
            </Label>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {t("uploadModal.sections.sensorDataDescription")}
            </p>
          </div>
          <div className="space-y-2">
            {sensorOptions.map((option) => (
              <div
                key={option.id}
                data-testid={`data-option-${option.id}`}
                className={optionCardVariants({
                  state: option.disabled
                    ? "disabled"
                    : selectedOption?.id === option.id
                      ? "selected"
                      : "available",
                })}
                onClick={() => !option.disabled && handleSelect(option.id)}
              >
                <RadioGroupItem
                  value={option.id}
                  disabled={option.disabled}
                  className="mt-0.5"
                  aria-label={t(option.labelKey)}
                />
                <div className="text-muted-foreground mt-0.5">{option.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="cursor-pointer font-medium">
                      {t(option.labelKey)}
                    </Label>
                    {option.disabled && (
                      <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
                        {t("uploadModal.comingSoon")}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t(option.descriptionKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Metadata Section */}
        <div className="space-y-3">
          <div>
            <Label className="text-base font-medium">
              {t("uploadModal.sections.metadata")}
            </Label>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {t("uploadModal.sections.metadataDescription")}
            </p>
          </div>
          <div className="space-y-2">
            {metadataOptions.map((option) => (
              <div
                key={option.id}
                data-testid={`data-option-${option.id}`}
                className={optionCardVariants({
                  state: option.disabled
                    ? "disabled"
                    : selectedOption?.id === option.id
                      ? "selected"
                      : "available",
                })}
                onClick={() => !option.disabled && handleSelect(option.id)}
              >
                <RadioGroupItem
                  value={option.id}
                  disabled={option.disabled}
                  className="mt-0.5"
                  aria-label={t(option.labelKey)}
                />
                <div className="text-muted-foreground mt-0.5">{option.icon}</div>
                <div className="flex-1">
                  <Label className="cursor-pointer font-medium">
                    {t(option.labelKey)}
                  </Label>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t(option.descriptionKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RadioGroup>
    </div>
  );
};
