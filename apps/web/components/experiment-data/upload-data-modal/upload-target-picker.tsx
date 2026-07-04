"use client";

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { ExperimentTableMetadata } from "~/hooks/experiment/useExperimentTables/useExperimentTables";

import type { UploadFormFields } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

export interface UploadTargetPickerProps {
  control: Control<UploadFormFields>;
  targetKind: "new" | "existing";
  uploadTables: ExperimentTableMetadata[];
  disabled: boolean;
}

export function UploadTargetPicker({
  control,
  targetKind,
  uploadTables,
  disabled,
}: UploadTargetPickerProps) {
  const { t } = useTranslation("experimentData");
  const hasExistingTables = uploadTables.length > 0;
  const isPickingNew = targetKind === "new";

  const existingLabelClassName = cn(
    "flex cursor-pointer items-center gap-2 rounded-md border p-3",
    !hasExistingTables && "pointer-events-none opacity-50",
  );

  return (
    <>
      <Controller
        control={control}
        name="targetKind"
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="target-new"
              className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
            >
              <RadioGroupItem id="target-new" value="new" />
              {t("experimentData.uploadDataModal.targetKind.new")}
            </Label>
            <Label htmlFor="target-existing" className={existingLabelClassName}>
              <RadioGroupItem id="target-existing" value="existing" disabled={!hasExistingTables} />
              {t("experimentData.uploadDataModal.targetKind.existing")}
            </Label>
          </RadioGroup>
        )}
      />

      {isPickingNew ? (
        <Controller
          control={control}
          name="targetName"
          render={({ field, fieldState }) => (
            <div className="space-y-1.5">
              <Label htmlFor="new-table-name">
                {t("experimentData.uploadDataModal.newTable.label")}
              </Label>
              <Input
                id="new-table-name"
                value={field.value}
                onChange={field.onChange}
                placeholder={t("experimentData.uploadDataModal.newTable.placeholder")}
                disabled={disabled}
              />
              {fieldState.error?.message && (
                <p className="text-destructive text-xs">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />
      ) : (
        <Controller
          control={control}
          name="uploadTableId"
          render={({ field, fieldState }) => (
            <div className="space-y-1.5">
              <Label htmlFor="existing-table-name">
                {t("experimentData.uploadDataModal.existingTable.label")}
              </Label>
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id="existing-table-name">
                  <SelectValue
                    placeholder={t("experimentData.uploadDataModal.existingTable.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {uploadTables.map((table) => (
                    <UploadTableOption key={table.identifier} table={table} />
                  ))}
                </SelectContent>
              </Select>
              {fieldState.error?.message && (
                <p className="text-destructive text-xs">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />
      )}
    </>
  );
}

interface UploadTableOptionProps {
  table: ExperimentTableMetadata;
}

function UploadTableOption({ table }: UploadTableOptionProps) {
  const { t } = useTranslation("experimentData");
  const rowsLabel = t("experimentData.uploadDataModal.existingTable.rowCount", {
    count: table.totalRows,
  });
  return (
    <SelectItem value={table.identifier}>
      {table.displayName} ({rowsLabel})
    </SelectItem>
  );
}
