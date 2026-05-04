"use client";

import { useWatch } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";

import { DisplayOptionsSection } from "../../workspace/style-sections/display-options-section";
import { FormSlider } from "../../workspace/style-sections/form-slider";
import { StyleSubsection } from "../../workspace/style-sections/style-subsection";
import type { ChartPanelProps } from "../types";

export function ScatterStylePanel({ form }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Line width / dash only matters when the chart actually draws a line
  // through the markers. Kept in its own subsection so the panel doesn't
  // show fields with no effect.
  const mode = useWatch({ control: form.control, name: "config.mode" }) ?? "markers";
  const hasLines = typeof mode === "string" && mode.includes("lines");

  return (
    <div className="space-y-6">
      <DisplayOptionsSection form={form} />
      <Separator />

      <section className="space-y-5">
        <h3 className="text-sm font-semibold">{t("workspace.style.scatterOptions")}</h3>

        <FormField
          control={form.control}
          name="config.mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.style.mode")}</FormLabel>
              <Select value={String(field.value ?? "markers")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="markers">{t("workspace.modes.markers")}</SelectItem>
                  <SelectItem value="lines+markers">{t("workspace.modes.linesMarkers")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <StyleSubsection title={t("workspace.style.markerSubsection", "Markers")}>
          <FormField
            control={form.control}
            name="config.marker.size"
            render={({ field }) => (
              <FormSlider
                label={t("workspace.style.markerSize")}
                // Plotly types marker.size as `number | number[]` for
                // per-point sizing; the slider only edits the scalar form.
                value={typeof field.value === "number" ? field.value : undefined}
                fallback={6}
                min={1}
                max={20}
                step={1}
                onCommit={field.onChange}
                formatBadge={(v) => `${v}px`}
              />
            )}
          />

          <FormField
            control={form.control}
            name="config.marker.opacity"
            render={({ field }) => (
              <FormSlider
                label={t("workspace.style.markerOpacity")}
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
                    <SelectItem value="asterisk">
                      {t("workspace.markerSymbols.asterisk")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </StyleSubsection>

        {hasLines && (
          <StyleSubsection title={t("workspace.style.lineSubsection", "Lines")}>
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
          </StyleSubsection>
        )}
      </section>
    </div>
  );
}
