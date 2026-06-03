"use client";

import { Grid2X2, Settings2 } from "lucide-react";
import { useId } from "react";

import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { FormSlider } from "@repo/ui/components/form-slider";
import { Input } from "@repo/ui/components/input";
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

function HeatmapDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} hideLegend flat={flat} />;
}

function HeatmapOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showColorbarId = useId();
  const showTextId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.heatmapOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.heatmapZsmooth"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.heatmapZsmooth")}
            </FormLabel>
            <Select value={String(field.value ?? "false")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="false">{t("workspace.style.heatmapZsmooths.off")}</SelectItem>
                <SelectItem value="best">{t("workspace.style.heatmapZsmooths.best")}</SelectItem>
                <SelectItem value="fast">{t("workspace.style.heatmapZsmooths.fast")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.heatmapColor")}>
        <ColorscalePicker form={form} name="config.heatmapColorscale" />

        <FormField
          control={form.control}
          name="config.heatmapReverseScale"
          render={({ field }) => {
            const reverseScaleId = `${field.name}-checkbox`;
            return (
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
            );
          }}
        />

        <FormField
          control={form.control}
          name="config.heatmapShowColorbar"
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

        <FormField
          control={form.control}
          name="config.heatmapColorbarTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.shelves.colorAxisTitle")}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t("workspace.shelves.colorAxisTitlePlaceholder")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.heatmapCellText")}>
        <FormField
          control={form.control}
          name="config.heatmapShowText"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showTextId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showTextId} className="text-xs font-medium">
                {t("workspace.style.heatmapShowText")}
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.heatmapTextDecimals"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.heatmapTextDecimals")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={2}
              min={0}
              max={6}
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

export const heatmapStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: HeatmapDisplay,
  },
  {
    key: "heatmap",
    labelKey: "workspace.style.heatmapOptions",
    icon: Grid2X2,
    Component: HeatmapOptions,
  },
];
