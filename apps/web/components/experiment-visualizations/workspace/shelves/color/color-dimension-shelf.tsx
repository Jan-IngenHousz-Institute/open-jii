"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isCategoricalColumnType } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import type { ChartFormValues } from "../../../charts/chart-config";
import { COLORSCALES } from "../../../charts/colors/colorscales";
import { firstDataSourceByRole, makeDataSource } from "../../../charts/data/data-sources";
import { useDataSourcesFieldArray } from "../../context/data-sources-field-array-context";
import { CategoricalColorMap } from "./categorical-color-map";
import { ContinuousColorSettings } from "./continuous-color-settings";

interface ColorDimensionShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
  categoricalOnly?: boolean;
  /** Render inline with no Collapsible chrome (for popover-hosted shelves). */
  flat?: boolean;
}

export function ColorDimensionShelf({
  form,
  columns,
  categoricalOnly = false,
  flat = false,
}: ColorDimensionShelfProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showColorbarId = useId();

  const { append, update, remove } = useDataSourcesFieldArray();

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const colorEntry = firstDataSourceByRole(sources, "color");
  const colorColumn = colorEntry?.source.columnName ?? "";
  // Disable continuous mode for non-numeric columns; the renderer can't interpolate.
  const colorColumnType = columns.find((c) => c.name === colorColumn)?.type_text;
  const colorColumnIsCategorical = isCategoricalColumnType(colorColumnType);
  const watchedColorMode = useWatch({ control: form.control, name: "config.colorMode" });
  // Categorical-only chart types pin the mode; legacy data may still hold "continuous".
  const colorMode = resolveColorMode({
    categoricalOnly,
    isCategorical: watchedColorMode === "categorical",
  });

  const colorscale = useWatch({ control: form.control, name: "config.marker.colorscale" }) as
    | string
    | undefined;
  const previewGradient =
    COLORSCALES.find((c) => c.value === colorscale)?.gradient ?? COLORSCALES[0].gradient;

  const handleColumnChange = (value: string) => {
    const isPickingColumn = value && value !== "none";
    const tableName = form.getValues("dataConfig.tableName");

    if (isPickingColumn) {
      const next = { ...makeDataSource(tableName, "color"), columnName: value };
      if (colorEntry) {
        update(colorEntry.index, next);
      } else {
        append(next);
      }
      // Re-stamp colorbar title on every column change so it tracks the picked column.
      form.setValue("config.marker.colorbar.title.text", value);
      // Auto-pick mode by column type; user can override below.
      const picked = columns.find((c) => c.name === value);
      const inferred = resolveColorMode({
        categoricalOnly,
        isCategorical: isCategoricalColumnType(picked?.type_text),
      });
      form.setValue("config.colorMode", inferred, { shouldDirty: true });
    } else {
      if (colorEntry) {
        remove(colorEntry.index);
      }
      form.setValue("config.marker.colorbar.title.text", "");
    }
  };

  const [open, setOpen] = useState(false);

  const body = (
    <>
      <FormItem>
        <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
        <Select
          value={colorColumn === "" ? "none" : colorColumn}
          onValueChange={handleColumnChange}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("workspace.shelves.groupByPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground italic">
                {t("workspace.shelves.groupByNone")}
              </span>
            </SelectItem>
            {columns.map((column) => (
              <SelectItem key={column.name} value={column.name}>
                <div className="flex items-center gap-2">
                  <span>{column.name}</span>
                  <Badge
                    variant="outline"
                    className="text-muted-foreground h-4 px-1.5 py-0 font-mono text-[10px] font-normal leading-none"
                  >
                    {column.type_name}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormItem>

      {colorColumn && (
        <div className="space-y-3">
          {/* Categorical-only chart types skip the Mode picker.
              Their renderer ignores `colorMode` and only emits the
              categorical-pivot path. */}
          {!categoricalOnly && (
            <FormField
              control={form.control}
              name="config.colorMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">
                    {t("workspace.shelves.colorMode")}
                  </FormLabel>
                  <Select
                    value={field.value ?? "continuous"}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem
                        value="continuous"
                        disabled={colorColumnIsCategorical}
                        title={
                          colorColumnIsCategorical
                            ? t("workspace.shelves.colorModeContinuousNeedsNumeric")
                            : undefined
                        }
                      >
                        {t("workspace.shelves.colorModeContinuous")}
                      </SelectItem>
                      <SelectItem value="categorical">
                        {t("workspace.shelves.colorModeCategorical")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {colorMode === "categorical" ? (
            <CategoricalColorMap form={form} columns={columns} />
          ) : (
            <ContinuousColorSettings
              control={form.control}
              previewGradient={previewGradient}
              showColorbarId={showColorbarId}
            />
          )}
        </div>
      )}
    </>
  );

  if (flat) {
    return <div className="space-y-3">{body}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <h3 className="text-sm font-semibold">{t("workspace.shelves.groupBy")}</h3>
          {colorColumn && <span className="text-muted-foreground text-xs">({colorColumn})</span>}
          <ChevronDown
            className={cn(
              "text-muted-foreground ml-auto h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3">{body}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function resolveColorMode(args: {
  categoricalOnly: boolean;
  isCategorical: boolean;
}): "continuous" | "categorical" {
  if (args.categoricalOnly) {
    return "categorical";
  }
  return args.isCategorical ? "categorical" : "continuous";
}
