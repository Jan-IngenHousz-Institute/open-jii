"use client";

import { Crosshair, Settings2 } from "lucide-react";
import { useId } from "react";

import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { FormSlider } from "@repo/ui/components/form-slider";
import { Input } from "@repo/ui/components/input";

import { ColorscalePicker } from "../../../../workspace/shelves/color/colorscale-picker";
import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import { StyleSubsection } from "../../../../workspace/style-sections/shared/style-subsection";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function DensityPlot2DDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} hideLegend flat={flat} />;
}

function DensityPlot2DOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const fillId = useId();
  const showColorbarId = useId();
  const showMarkersId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.densityPlot2dOptions")} flat={flat}>
      <StyleSubsection title={t("workspace.style.densityPlot2dPoints")}>
        <FormField
          control={form.control}
          name="config.density2dShowMarkers"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showMarkersId}
                  // Default-on: treat undefined as checked.
                  checked={field.value !== false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showMarkersId} className="text-xs font-medium">
                {t("workspace.style.density2dShowMarkers")}
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.density2dMarkerSize"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.markerSize")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={4}
              min={1}
              max={12}
              step={1}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.density2dMarkerOpacity"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.markerOpacity")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={0.4}
              min={0.05}
              max={1}
              step={0.05}
              onCommit={field.onChange}
              formatBadge={(v) => `${Math.round(v * 100)}%`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.color.0"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.markerColor")}
              </FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-9 w-12 shrink-0 p-1"
                    value={typeof field.value === "string" ? field.value : "#3b82f6"}
                    onChange={field.onChange}
                  />
                  <Input
                    type="text"
                    className="min-w-0 font-mono text-sm"
                    placeholder="#000000"
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={field.onChange}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.densityPlot2dContour")}>
        <FormField
          control={form.control}
          name="config.hist2dNbinsX"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.hist2dNbinsX")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={0}
              min={0}
              max={100}
              step={1}
              onCommit={(v) => field.onChange(v === 0 ? undefined : v)}
              formatBadge={(v) => (v === 0 ? t("workspace.style.nbinsAuto") : `${v}`)}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.hist2dNbinsY"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.hist2dNbinsY")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={0}
              min={0}
              max={100}
              step={1}
              onCommit={(v) => field.onChange(v === 0 ? undefined : v)}
              formatBadge={(v) => (v === 0 ? t("workspace.style.nbinsAuto") : `${v}`)}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.density2dContourFill"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={fillId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={fillId} className="text-xs font-medium">
                {t("workspace.style.density2dContourFill")}
              </FormLabel>
            </FormItem>
          )}
        />

        <ColorscalePicker form={form} name="config.hist2dColorscale" />

        <FormField
          control={form.control}
          name="config.hist2dReverseScale"
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
          name="config.density2dShowColorbar"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showColorbarId}
                  // Default-on: treat undefined as checked.
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
          name="config.hist2dColorbarTitle"
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

export const densityPlot2DStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: DensityPlot2DDisplay,
  },
  {
    key: "density2d",
    labelKey: "workspace.style.densityPlot2dOptions",
    icon: Crosshair,
    Component: DensityPlot2DOptions,
  },
];
