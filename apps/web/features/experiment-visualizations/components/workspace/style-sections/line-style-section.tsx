"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

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

import type { ChartFormValues } from "../../charts/chart-config";
import { CollapsibleStyleSection } from "./shared/collapsible-style-section";
import { StyleSubsection } from "./shared/style-subsection";

interface LineStyleSectionProps {
  form: UseFormReturn<ChartFormValues>;
  titleKey?: string;
  defaultTitle?: string;
  flat?: boolean;
}

/**
 * Reusable line-shape style controls: mode select + line subsection +
 * marker subsection. Applies to every line-shaped trace in the chart.
 */
export function LineStyleSection({
  form,
  titleKey = "workspace.style.lineOptions",
  defaultTitle,
  flat = false,
}: LineStyleSectionProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Width / dash / smoothing only apply when the chart actually draws lines.
  // Marker opacity only applies when the chart draws markers. Read the live
  // mode and conditionally render the relevant subsections so the panel
  // doesn't bury users in fields that don't affect their chart.
  const mode = useWatch({ control: form.control, name: "config.mode" }) ?? "lines";
  const hasLines = typeof mode === "string" && mode.includes("lines");
  const hasMarkers = typeof mode === "string" && mode.includes("markers");

  return (
    <CollapsibleStyleSection title={t(titleKey, defaultTitle ?? "Line options")} flat={flat}>
      <FormField
        control={form.control}
        name="config.mode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.mode")}</FormLabel>
            <Select value={String(field.value ?? "lines")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="lines">{t("workspace.modes.lines")}</SelectItem>
                <SelectItem value="markers">{t("workspace.modes.markers")}</SelectItem>
                <SelectItem value="lines+markers">{t("workspace.modes.linesMarkers")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {hasLines && (
        <StyleSubsection title={t("workspace.style.lineSubsection")}>
          <FormField
            control={form.control}
            name="config.connectgaps"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    id="connectGaps"
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel htmlFor="connectGaps" className="text-xs font-medium">
                  {t("workspace.style.connectGaps")}
                </FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="config.line.width"
            render={({ field }) => (
              <FormSlider
                label={t("workspace.style.lineWidth")}
                value={field.value}
                fallback={2}
                min={1}
                max={10}
                step={1}
                onCommit={field.onChange}
                formatBadge={(v) => `${v}px`}
              />
            )}
          />

          <FormField
            control={form.control}
            name="config.line.dash"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.style.lineDash")}
                </FormLabel>
                <Select
                  value={typeof field.value === "string" ? field.value : "solid"}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="solid">{t("workspace.lineDashes.solid")}</SelectItem>
                    <SelectItem value="dot">{t("workspace.lineDashes.dot")}</SelectItem>
                    <SelectItem value="dash">{t("workspace.lineDashes.dash")}</SelectItem>
                    <SelectItem value="dashdot">{t("workspace.lineDashes.dashdot")}</SelectItem>
                    <SelectItem value="longdash">{t("workspace.lineDashes.longdash")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="config.line.smoothing"
            render={({ field }) => (
              <FormSlider
                label={t("workspace.style.smoothing")}
                value={field.value}
                fallback={0}
                min={0}
                max={1}
                step={0.05}
                onCommit={field.onChange}
                formatBadge={(v) => `${Math.round(v * 100)}%`}
              />
            )}
          />
        </StyleSubsection>
      )}

      {hasMarkers && (
        <StyleSubsection title={t("workspace.style.markerSubsection")}>
          <FormField
            control={form.control}
            name="config.marker.opacity"
            render={({ field }) => (
              <FormSlider
                label={t("workspace.style.markerOpacity")}
                // Plotly types marker.opacity as `number | number[]` to
                // support per-point opacity; the slider only edits the
                // scalar form, so pass through scalars and fall back
                // when the value happens to be an array.
                value={typeof field.value === "number" ? field.value : undefined}
                fallback={0.8}
                min={0.05}
                max={1}
                step={0.05}
                onCommit={field.onChange}
                formatBadge={(v) => `${Math.round(v * 100)}%`}
              />
            )}
          />
        </StyleSubsection>
      )}
    </CollapsibleStyleSection>
  );
}
