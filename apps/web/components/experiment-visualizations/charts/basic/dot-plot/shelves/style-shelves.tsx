"use client";

import { Circle, Minus, MoveVertical, Settings2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { FormSlider } from "@repo/ui/components/form-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { ErrorBarStyleSection } from "../../../../workspace/style-sections/error-bar-style-section";
import { ReferenceLinesSection } from "../../../../workspace/style-sections/reference-lines-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import { StyleSubsection } from "../../../../workspace/style-sections/shared/style-subsection";
import { hasAnyErrorColumn } from "../../../shelf-visibility";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function DotPlotDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function DotPlotOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <CollapsibleStyleSection title={t("workspace.style.dotPlotOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.orientation"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.orientation")}
            </FormLabel>
            <Select value={String(field.value ?? "v")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="v">{t("workspace.orientations.vertical")}</SelectItem>
                <SelectItem value="h">{t("workspace.orientations.horizontal")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.markerSubsection")}>
        <FormField
          control={form.control}
          name="config.marker.size"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.dotSize")}
              // marker.size is `number | number[]` in Plotly's types; the
              // slider only edits the scalar form, so fall back when an
              // array happens to be in there.
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={10}
              min={4}
              max={30}
              step={1}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.marker.symbol"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.markerShape")}
              </FormLabel>
              <Select value={String(field.value ?? "circle")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="circle">{t("workspace.markerSymbols.circle")}</SelectItem>
                  <SelectItem value="square">{t("workspace.markerSymbols.square")}</SelectItem>
                  <SelectItem value="diamond">{t("workspace.markerSymbols.diamond")}</SelectItem>
                  <SelectItem value="triangle-up">
                    {t("workspace.markerSymbols.triangleUp")}
                  </SelectItem>
                  <SelectItem value="triangle-down">
                    {t("workspace.markerSymbols.triangleDown")}
                  </SelectItem>
                  <SelectItem value="star">{t("workspace.markerSymbols.star")}</SelectItem>
                  <SelectItem value="hexagon">{t("workspace.markerSymbols.hexagon")}</SelectItem>
                  <SelectItem value="cross">{t("workspace.markerSymbols.cross")}</SelectItem>
                  <SelectItem value="x">{t("workspace.markerSymbols.x")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.marker.opacity"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.markerOpacity")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={1}
              min={0.05}
              max={1}
              step={0.05}
              onCommit={field.onChange}
              formatBadge={(v) => `${Math.round(v * 100)}%`}
            />
          )}
        />
      </StyleSubsection>
    </CollapsibleStyleSection>
  );
}

function DotPlotErrorBar({ form, flat }: ChartPanelProps) {
  return <ErrorBarStyleSection form={form} flat={flat} />;
}

function DotPlotReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

export const dotPlotStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: DotPlotDisplay,
  },
  {
    key: "dotPlot",
    labelKey: "workspace.style.dotPlotOptions",
    icon: Circle,
    Component: DotPlotOptions,
  },
  {
    key: "errorBar",
    labelKey: "workspace.style.errorBarOptions",
    icon: MoveVertical,
    Component: DotPlotErrorBar,
    visible: hasAnyErrorColumn,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: DotPlotReferenceLines,
  },
];
