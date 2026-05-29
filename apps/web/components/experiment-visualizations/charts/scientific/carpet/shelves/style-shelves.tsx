"use client";

import { Grid3x3, Settings2 } from "lucide-react";
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

function CarpetDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} hideLegend flat={flat} />;
}

function CarpetOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const reverseScaleId = useId();
  const showColorbarId = useId();
  const showContourLabelsId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.carpetOptions")} flat={flat}>
      <StyleSubsection title={t("workspace.style.carpetContours")}>
        <FormField
          control={form.control}
          name="config.carpetContourColoring"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.carpetContourColoring")}
              </FormLabel>
              <Select value={String(field.value ?? "fill")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="fill">
                    {t("workspace.style.carpetContourColorings.fill")}
                  </SelectItem>
                  <SelectItem value="lines">
                    {t("workspace.style.carpetContourColorings.lines")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.carpetNContours"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.carpetNContours")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={15}
              min={2}
              max={40}
              step={1}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => `${v}`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.carpetShowContourLabels"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showContourLabelsId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showContourLabelsId} className="text-xs font-medium">
                {t("workspace.style.carpetShowContourLabels")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.carpetColor")}>
        <ColorscalePicker form={form} name="config.carpetColorscale" />

        <FormField
          control={form.control}
          name="config.carpetReverseScale"
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
          name="config.carpetShowColorbar"
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
          name="config.carpetColorbarTitle"
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
    </CollapsibleStyleSection>
  );
}

export const carpetStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: CarpetDisplay,
  },
  {
    key: "carpet",
    labelKey: "workspace.style.carpetOptions",
    icon: Grid3x3,
    Component: CarpetOptions,
  },
];
