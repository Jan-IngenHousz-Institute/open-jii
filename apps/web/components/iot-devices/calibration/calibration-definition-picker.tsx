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
      <div key={definition.id} className="flex items-start gap-3 rounded-md border p-3">
        <RadioGroupItem value={definition.id} id={inputId} className="mt-1" />
        <Label htmlFor={inputId} className="flex-1 cursor-pointer space-y-1 font-normal">
          <span className="block text-sm font-medium">
            {definition.name}
            <span className="text-muted-foreground ml-2 text-xs">
              {t("iot.calibration.runs.definition", { version: definition.version })}
            </span>
          </span>
          {definition.description !== null && (
            <span className="text-muted-foreground block text-xs">{definition.description}</span>
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
