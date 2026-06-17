"use client";

import { BarChart3, LayoutGrid, Minus, Settings2 } from "lucide-react";
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

import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { FacetStyleSection } from "../../../../workspace/style-sections/facet-style-section";
import { ReferenceLinesSection } from "../../../../workspace/style-sections/reference-lines-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import { StyleSubsection } from "../../../../workspace/style-sections/shared/style-subsection";
import { hasFacetSource } from "../../../shelf-visibility";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function HistogramDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function HistogramOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const cumulativeId = useId();
  const showNormalFitId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.histogramOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.histogramOrientation"
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

      <FormField
        control={form.control}
        name="config.histnorm"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.histnorm")}</FormLabel>
            <Select
              // The schema stores `""` for "no normalisation" (matches
              // Plotly's `histnorm` literal); the Select needs a non-empty
              // key to render its label, so map "" / "none" at boundary.
              value={field.value === undefined || field.value === "" ? "none" : String(field.value)}
              onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">
                    {t("workspace.histnorms.none")}
                  </span>
                </SelectItem>
                <SelectItem value="percent">{t("workspace.histnorms.percent")}</SelectItem>
                <SelectItem value="probability">{t("workspace.histnorms.probability")}</SelectItem>
                <SelectItem value="density">{t("workspace.histnorms.density")}</SelectItem>
                <SelectItem value="probability density">
                  {t("workspace.histnorms.probabilityDensity")}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.histogramBarmode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.barmode")}</FormLabel>
            <Select value={String(field.value ?? "overlay")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="overlay">{t("workspace.barmodes.overlay")}</SelectItem>
                <SelectItem value="stack">{t("workspace.barmodes.stack")}</SelectItem>
                <SelectItem value="group">{t("workspace.barmodes.group")}</SelectItem>
                <SelectItem value="relative">{t("workspace.barmodes.relative")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.histogramBinning")}>
        <FormField
          control={form.control}
          name="config.nbinsx"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.nbinsx")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={0}
              min={0}
              max={100}
              step={1}
              onCommit={(v) => field.onChange(v === 0 ? undefined : v)}
              // 0 means "let Plotly auto-pick"; show that as a hint so
              // users don't think the slider is broken at the floor.
              formatBadge={(v) => (v === 0 ? t("workspace.style.nbinsAuto") : `${v}`)}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.cumulative"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={cumulativeId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={cumulativeId} className="text-xs font-medium">
                {t("workspace.style.cumulative")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.histogramOverlay")}>
        <FormField
          control={form.control}
          name="config.showNormalFit"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showNormalFitId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showNormalFitId} className="text-xs font-medium">
                {t("workspace.style.showNormalFit")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.markerSubsection")}>
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

function HistogramReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

function HistogramFacetStyle({ form, flat }: ChartPanelProps) {
  return <FacetStyleSection form={form} flat={flat} />;
}

export const histogramStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: HistogramDisplay,
  },
  {
    key: "histogram",
    labelKey: "workspace.style.histogramOptions",
    icon: BarChart3,
    Component: HistogramOptions,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: HistogramReferenceLines,
  },
  {
    key: "facet",
    labelKey: "workspace.style.facetOptions",
    icon: LayoutGrid,
    Component: HistogramFacetStyle,
    visible: hasFacetSource,
  },
];
