"use client";

import { Settings2, Table } from "lucide-react";
import { useId } from "react";

import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { FormSlider } from "@repo/ui/components/form-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { ColorscalePicker } from "../../../../workspace/shelves/color/colorscale-picker";
import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import { StyleSubsection } from "../../../../workspace/style-sections/shared/style-subsection";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function CorrelationDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} hideLegend flat={flat} />;
}

function CorrelationOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showValuesId = useId();
  const showColorbarId = useId();
  const reverseScaleId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.correlationMatrixOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.corrMethod"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.corrMethod")}</FormLabel>
            <Select value={String(field.value ?? "pearson")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="pearson">{t("workspace.style.corrMethods.pearson")}</SelectItem>
                {/* Spearman deferred: needs the SQL builder to wrap each
                    column in `RANK() OVER (ORDER BY col)` before `corr()`. */}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.correlationMatrixColor")}>
        <ColorscalePicker form={form} name="config.corrColorscale" defaultValue="RdBu" />

        <FormField
          control={form.control}
          name="config.corrReverseScale"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={reverseScaleId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={reverseScaleId} className="text-xs font-medium">
                {t("workspace.shelves.reverseScale")}
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.corrShowColorbar"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showColorbarId}
                  checked={field.value !== false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showColorbarId} className="text-xs font-medium">
                {t("workspace.shelves.showColorbar")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.correlationMatrixCellText")}>
        <FormField
          control={form.control}
          name="config.corrShowValues"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showValuesId}
                  checked={field.value !== false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showValuesId} className="text-xs font-medium">
                {t("workspace.style.corrShowValues")}
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.corrTextDecimals"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.corrTextDecimals")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={2}
              min={0}
              max={4}
              step={1}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => `${v}`}
            />
          )}
        />
      </StyleSubsection>
    </CollapsibleStyleSection>
  );
}

export const correlationMatrixStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: CorrelationDisplay,
  },
  {
    key: "correlation",
    labelKey: "workspace.style.correlationMatrixOptions",
    icon: Table,
    Component: CorrelationOptions,
  },
];
