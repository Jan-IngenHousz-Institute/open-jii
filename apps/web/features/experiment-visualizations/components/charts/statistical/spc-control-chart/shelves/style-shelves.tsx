"use client";

import { Activity, Settings2 } from "lucide-react";
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
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import { StyleSubsection } from "../../../../workspace/style-sections/shared/style-subsection";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function SPCDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function SPCOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showWarningId = useId();
  const highlightOutliersId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.spcOptions")} flat={flat}>
      <StyleSubsection title={t("workspace.style.spcLimits")}>
        <FormField
          control={form.control}
          name="config.spcSigmaMultiplier"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.spcSigmaMultiplier")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={3}
              min={1}
              max={4}
              step={0.5}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}σ`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.spcShowWarningLimits"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showWarningId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showWarningId} className="text-xs font-medium">
                {t("workspace.style.spcShowWarningLimits")}
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.spcHighlightOutliers"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={highlightOutliersId}
                  // Default-on: treat undefined as checked so the control
                  // matches the rendered state on first paint.
                  checked={field.value !== false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={highlightOutliersId} className="text-xs font-medium">
                {t("workspace.style.spcHighlightOutliers")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.spcAppearance")}>
        <FormField
          control={form.control}
          name="config.spcMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.style.spcMode")}</FormLabel>
              <Select value={String(field.value ?? "lines+markers")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="lines+markers">
                    {t("workspace.spcModes.linesMarkers")}
                  </SelectItem>
                  <SelectItem value="lines">{t("workspace.spcModes.lines")}</SelectItem>
                  <SelectItem value="markers">{t("workspace.spcModes.markers")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.spcMarkerSize"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.markerSize")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={5}
              min={2}
              max={12}
              step={1}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.spcMarkerOpacity"
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

export const spcControlChartStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: SPCDisplay,
  },
  {
    key: "spc",
    labelKey: "workspace.style.spcOptions",
    icon: Activity,
    Component: SPCOptions,
  },
];
