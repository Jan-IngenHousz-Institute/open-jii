"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

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

import type { ChartFormValues } from "../../charts/chart-config";
import { CollapsibleStyleSection } from "./shared/collapsible-style-section";
import { StyleSubsection } from "./shared/style-subsection";

interface BarStyleSectionProps {
  form: UseFormReturn<ChartFormValues>;
  titleKey?: string;
  defaultTitle?: string;
  showOrientation?: boolean;
  flat?: boolean;
}

/**
 * Reusable bar-shape style controls: orientation, barmode, barnorm,
 * bargap, plus marker opacity (the bar's fill alpha).
 */
export function BarStyleSection({
  form,
  titleKey = "workspace.style.barOptions",
  defaultTitle,
  showOrientation = true,
  flat = false,
}: BarStyleSectionProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Normalisation only applies when bars are stacked (stack/relative modes).
  // For grouped/overlay mode the field has no effect on the rendering, so
  // hide it instead of showing a control whose value doesn't matter.
  const barmode = useWatch({ control: form.control, name: "config.barmode" }) ?? "group";
  const stackable = barmode === "stack" || barmode === "relative";

  return (
    <CollapsibleStyleSection title={t(titleKey, defaultTitle ?? "Bar options")} flat={flat}>
      {showOrientation && (
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
      )}

      <FormField
        control={form.control}
        name="config.barmode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.barmode")}</FormLabel>
            <Select value={String(field.value ?? "group")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="group">{t("workspace.barmodes.group")}</SelectItem>
                <SelectItem value="stack">{t("workspace.barmodes.stack")}</SelectItem>
                <SelectItem value="relative">{t("workspace.barmodes.relative")}</SelectItem>
                <SelectItem value="overlay">{t("workspace.barmodes.overlay")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {stackable && (
        <FormField
          control={form.control}
          name="config.barnorm"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.style.barnorm")}</FormLabel>
              <Select
                value={String(field.value ?? "")}
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
                      {t("workspace.barnorms.none")}
                    </span>
                  </SelectItem>
                  <SelectItem value="fraction">{t("workspace.barnorms.fraction")}</SelectItem>
                  <SelectItem value="percent">{t("workspace.barnorms.percent")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <StyleSubsection title={t("workspace.style.barAppearance")}>
        <FormField
          control={form.control}
          name="config.bargap"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.bargap")}
              value={field.value}
              fallback={0.15}
              min={0}
              max={0.9}
              step={0.05}
              onCommit={field.onChange}
              formatBadge={(v) => `${Math.round(v * 100)}%`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.marker.opacity"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.markerOpacity")}
              // marker.opacity is `number | number[]` in Plotly's types
              // (per-bar opacity arrays are rare but possible). The slider
              // only edits the scalar form, so fall back when an array
              // happens to be in there.
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={0.85}
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
