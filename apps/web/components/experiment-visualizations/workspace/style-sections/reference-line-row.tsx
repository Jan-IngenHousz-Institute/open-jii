"use client";

import { Trash2 } from "lucide-react";
import { useId } from "react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel } from "@repo/ui/components/form";
import { FormColorInput } from "@repo/ui/components/form-color-input";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../charts/chart-config";

const DEFAULT_COLOR = "#9ca3af";

export interface ReferenceLineRowProps {
  form: UseFormReturn<ChartFormValues>;
  index: number;
  onRemove: () => void;
}

export function ReferenceLineRow({ form, index, onRemove }: ReferenceLineRowProps) {
  const { t } = useTranslation("experimentVisualizations");
  const labelId = useId();

  const handleValueChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (v: unknown) => void,
  ) => {
    const v = e.target.value;
    onChange(v === "" ? undefined : Number(v));
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-end gap-2">
        <FormField
          control={form.control}
          name={`config.referenceLines.${index}.axis` as never}
          render={({ field }) => (
            <FormItem className="w-20 shrink-0">
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.referenceLineAxis")}
              </FormLabel>
              <Select value={String(field.value)} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="x">X</SelectItem>
                  <SelectItem value="y">Y</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`config.referenceLines.${index}.value` as never}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.referenceLineValue")}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  value={typeof field.value === "number" ? field.value : ""}
                  onChange={(e) => handleValueChange(e, field.onChange)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label={t("workspace.style.referenceLineRemove")}
        >
          <Trash2 className="text-muted-foreground h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <FormField
          control={form.control}
          name={`config.referenceLines.${index}.color` as never}
          render={({ field }) => (
            <FormItem className="shrink-0">
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.referenceLineColor")}
              </FormLabel>
              <FormControl>
                <FormColorInput
                  value={typeof field.value === "string" ? field.value : undefined}
                  fallback={DEFAULT_COLOR}
                  onCommit={field.onChange}
                  showHex={false}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`config.referenceLines.${index}.dash` as never}
          render={({ field }) => (
            <FormItem className="w-28 shrink-0">
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.referenceLineDash")}
              </FormLabel>
              <Select value={String(field.value)} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="solid">
                    {t("workspace.style.referenceLineDashes.solid")}
                  </SelectItem>
                  <SelectItem value="dash">
                    {t("workspace.style.referenceLineDashes.dash")}
                  </SelectItem>
                  <SelectItem value="dot">
                    {t("workspace.style.referenceLineDashes.dot")}
                  </SelectItem>
                  <SelectItem value="dashdot">
                    {t("workspace.style.referenceLineDashes.dashdot")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`config.referenceLines.${index}.label` as never}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel htmlFor={labelId} className="text-xs font-medium">
                {t("workspace.style.referenceLineLabel")}
              </FormLabel>
              <FormControl>
                <Input
                  id={labelId}
                  type="text"
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={field.onChange}
                  placeholder={t("workspace.style.referenceLineLabelPlaceholder")}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
