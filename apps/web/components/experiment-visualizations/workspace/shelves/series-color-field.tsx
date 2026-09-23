"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { FormControl, FormItem, FormLabel } from "@repo/ui/components/form";
import { FormColorInput } from "@repo/ui/components/form-color-input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";

import type { ChartFormValues } from "../../charts/chart-config";
import { getSuggestedSeriesColor } from "../../charts/colors/palettes";

interface SeriesColorFieldProps {
  form: UseFormReturn<ChartFormValues>;
  seriesIndex: number;
  isColorMapped: boolean;
}

/**
 * Watched and set rather than registered: registering an index into the optional
 * `config.color` array makes react-hook-form write a placeholder into it, which
 * autosave reads as an edit.
 */
export function SeriesColorField({ form, seriesIndex, isColorMapped }: SeriesColorFieldProps) {
  const { t } = useTranslation("experimentVisualizations");

  const colorPath: `config.color.${number}` = `config.color.${seriesIndex}`;
  const color = useWatch({ control: form.control, name: colorPath });

  const handleCommit = (hex: string) => {
    form.setValue(colorPath, hex, { shouldDirty: true });
  };

  return (
    <FormItem>
      <FormLabel className="text-xs font-medium">{t("workspace.shelves.color")}</FormLabel>
      <Tooltip>
        <TooltipTrigger asChild>
          <FormControl>
            <FormColorInput
              value={typeof color === "string" ? color : undefined}
              fallback={getSuggestedSeriesColor()}
              onCommit={handleCommit}
              disabled={isColorMapped}
            />
          </FormControl>
        </TooltipTrigger>
        {isColorMapped && (
          <TooltipContent>
            {t("workspace.shelves.seriesColorDisabledByColorDimension")}
          </TooltipContent>
        )}
      </Tooltip>
    </FormItem>
  );
}
