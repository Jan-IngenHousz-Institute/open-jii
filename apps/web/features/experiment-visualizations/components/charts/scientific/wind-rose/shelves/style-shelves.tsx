"use client";

import { Settings2, Wind } from "lucide-react";
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

function WindRoseDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function WindRoseOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const reverseScaleId = useId();
  const showLabelsId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.windRoseOptions")} flat={flat}>
      <StyleSubsection title={t("workspace.style.windRoseBinning")}>
        <FormField
          control={form.control}
          name="config.windRoseDirectionBins"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.windRoseDirectionBins")}
              </FormLabel>
              <Select
                value={String(field.value ?? 8)}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="8">
                    {t("workspace.style.windRoseDirectionBinValues.eight")}
                  </SelectItem>
                  <SelectItem value="16">
                    {t("workspace.style.windRoseDirectionBinValues.sixteen")}
                  </SelectItem>
                  <SelectItem value="32">
                    {t("workspace.style.windRoseDirectionBinValues.thirtyTwo")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.windRoseValueBins"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.windRoseValueBins")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={5}
              min={2}
              max={8}
              step={1}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => `${v}`}
            />
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.windRoseColor")}>
        <ColorscalePicker form={form} name="config.windRoseColorscale" />

        <FormField
          control={form.control}
          name="config.windRoseReverseScale"
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
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.windRoseLabels")}>
        <FormField
          control={form.control}
          name="config.windRoseShowDirectionLabels"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showLabelsId}
                  checked={field.value !== false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showLabelsId} className="text-xs font-medium">
                {t("workspace.style.windRoseShowDirectionLabels")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>
    </CollapsibleStyleSection>
  );
}

export const windRoseStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: WindRoseDisplay,
  },
  {
    key: "windRose",
    labelKey: "workspace.style.windRoseOptions",
    icon: Wind,
    Component: WindRoseOptions,
  },
];
