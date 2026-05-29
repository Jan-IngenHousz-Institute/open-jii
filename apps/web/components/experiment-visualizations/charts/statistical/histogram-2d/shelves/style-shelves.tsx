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

function Histogram2DDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} hideLegend flat={flat} />;
}

function Histogram2DOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showColorbarId = useId();
  const contourFillId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.histogram2dOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.hist2dRenderMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.hist2dRenderMode")}
            </FormLabel>
            <Select value={String(field.value ?? "heatmap")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="heatmap">{t("workspace.hist2dRenderModes.heatmap")}</SelectItem>
                <SelectItem value="contour">{t("workspace.hist2dRenderModes.contour")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.hist2dContourFill"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={contourFillId}
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={contourFillId} className="text-xs font-medium">
              {t("workspace.style.hist2dContourFill")}
            </FormLabel>
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.histogram2dBinning")}>
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
      </StyleSubsection>

      <FormField
        control={form.control}
        name="config.hist2dHistnorm"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.histnorm")}</FormLabel>
            <Select
              // Map "" / "none" at the boundary; same pattern as 1D histogram.
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

      <StyleSubsection title={t("workspace.style.histogram2dColor")}>
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
          name="config.hist2dShowColorbar"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showColorbarId}
                  // Default on: treat undefined as checked.
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

export const histogram2DStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: Histogram2DDisplay,
  },
  {
    key: "histogram2d",
    labelKey: "workspace.style.histogram2dOptions",
    icon: Grid3x3,
    Component: Histogram2DOptions,
  },
];
