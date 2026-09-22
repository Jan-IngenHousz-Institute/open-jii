"use client";

import type { CalibrationDefinitionSummary } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { Skeleton } from "@repo/ui/components/skeleton";

interface CalibrationDefinitionPickerProps {
  definitions: CalibrationDefinitionSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  selectedId: string | null;
  onSelect: (definitionId: string) => void;
}

export function CalibrationDefinitionPicker({
  definitions,
  isLoading,
  isError,
  selectedId,
  onSelect,
}: CalibrationDefinitionPickerProps) {
  const { t } = useTranslation("iot");

  function renderDefinition(definition: CalibrationDefinitionSummary) {
    const inputId = `calibration-definition-${definition.id}`;
    return (
      <div
        key={definition.id}
        className="hover:bg-muted/40 flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors"
      >
        <RadioGroupItem value={definition.id} id={inputId} className="mt-0.5" />
        {/* The shared label is a row; the name has to sit above the description, not beside it. */}
        <Label
          htmlFor={inputId}
          className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 font-normal"
        >
          <span className="text-sm font-medium">
            {definition.name}
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              {t("iot.calibration.runs.definition", { version: definition.version })}
            </span>
          </span>
          {definition.description !== null && (
            <span className="text-muted-foreground text-xs leading-relaxed">
              {definition.description}
            </span>
          )}
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
  if (!definitions || definitions.length === 0) {
    return <EmptyState size="inline" description={t("iot.calibration.choose.empty")} />;
  }

  return (
    <RadioGroup value={selectedId ?? ""} onValueChange={onSelect} className="space-y-2">
      {definitions.map(renderDefinition)}
    </RadioGroup>
  );
}
