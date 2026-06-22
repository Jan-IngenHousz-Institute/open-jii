"use client";

import {
  AreaChart,
  BarChart3,
  CircleDot,
  LayoutGrid,
  Minus,
  Settings2,
  Spline,
} from "lucide-react";

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

import { AreaStyleSection } from "../../../../workspace/style-sections/area-style-section";
import { BarStyleSection } from "../../../../workspace/style-sections/bar-style-section";
import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { FacetStyleSection } from "../../../../workspace/style-sections/facet-style-section";
import { LineStyleSection } from "../../../../workspace/style-sections/line-style-section";
import { ReferenceLinesSection } from "../../../../workspace/style-sections/reference-lines-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import { StyleSubsection } from "../../../../workspace/style-sections/shared/style-subsection";
import { hasFacetSource, hasTraceType } from "../../../shelf-visibility";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function BubbleDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function BubbleOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <CollapsibleStyleSection title={t("workspace.style.bubbleOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.sizemode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.sizemode")}</FormLabel>
            <Select value={String(field.value ?? "area")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="area">{t("workspace.sizemodes.area")}</SelectItem>
                <SelectItem value="diameter">{t("workspace.sizemodes.diameter")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.bubbleSizingSubsection")}>
        <FormField
          control={form.control}
          name="config.bubbleMaxSize"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.maxBubbleSize")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={40}
              min={10}
              max={80}
              step={2}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.bubbleMinSize"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.minBubbleSize")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={4}
              min={0}
              max={20}
              step={1}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.markerSubsection")}>
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
                  <SelectItem value="hexagon">{t("workspace.markerSymbols.hexagon")}</SelectItem>
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
              fallback={0.7}
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

function BubbleLineSeries({ form, flat }: ChartPanelProps) {
  return (
    <LineStyleSection
      form={form}
      titleKey="workspace.style.lineSeriesOptions"
      defaultTitle="Line series"
      flat={flat}
    />
  );
}

function BubbleBarSeries({ form, flat }: ChartPanelProps) {
  return (
    <BarStyleSection
      form={form}
      titleKey="workspace.style.barSeriesOptions"
      defaultTitle="Bar series"
      showOrientation={false}
      flat={flat}
    />
  );
}

function BubbleAreaSeries({ form, flat }: ChartPanelProps) {
  return (
    <AreaStyleSection
      form={form}
      titleKey="workspace.style.areaSeriesOptions"
      defaultTitle="Area series"
      flat={flat}
    />
  );
}

function BubbleReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

function BubbleFacetStyle({ form, flat }: ChartPanelProps) {
  return <FacetStyleSection form={form} flat={flat} />;
}

export const bubbleStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: BubbleDisplay,
  },
  {
    key: "bubble",
    labelKey: "workspace.style.bubbleOptions",
    icon: CircleDot,
    Component: BubbleOptions,
  },
  {
    key: "line",
    labelKey: "workspace.style.lineSeriesOptions",
    icon: Spline,
    Component: BubbleLineSeries,
    visible: (form) => hasTraceType(form, "line"),
  },
  {
    key: "bar",
    labelKey: "workspace.style.barSeriesOptions",
    icon: BarChart3,
    Component: BubbleBarSeries,
    visible: (form) => hasTraceType(form, "bar"),
  },
  {
    key: "area",
    labelKey: "workspace.style.areaSeriesOptions",
    icon: AreaChart,
    Component: BubbleAreaSeries,
    visible: (form) => hasTraceType(form, "area"),
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: BubbleReferenceLines,
  },
  {
    key: "facet",
    labelKey: "workspace.style.facetOptions",
    icon: LayoutGrid,
    Component: BubbleFacetStyle,
    visible: hasFacetSource,
  },
];
