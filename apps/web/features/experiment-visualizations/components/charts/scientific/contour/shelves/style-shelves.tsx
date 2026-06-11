"use client";

import { Map, Settings2 } from "lucide-react";
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

function ContourDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} hideLegend flat={flat} />;
}

function ContourOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showColorbarId = useId();
  const showLinesId = useId();
  const showLabelsId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.contourOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.contourColoring"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.contourColoring")}
            </FormLabel>
            <Select value={String(field.value ?? "fill")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="fill">{t("workspace.style.contourColorings.fill")}</SelectItem>
                <SelectItem value="lines">{t("workspace.style.contourColorings.lines")}</SelectItem>
                <SelectItem value="heatmap">
                  {t("workspace.style.contourColorings.heatmap")}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.contourShowLines"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={showLinesId}
                checked={field.value !== false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={showLinesId} className="text-xs font-medium">
              {t("workspace.style.contourShowLines")}
            </FormLabel>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.contourShowLabels"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={showLabelsId}
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={showLabelsId} className="text-xs font-medium">
              {t("workspace.style.contourShowLabels")}
            </FormLabel>
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.contourLines")}>
        <FormField
          control={form.control}
          name="config.contourLineWidth"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.contourLineWidth")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={1}
              min={0.5}
              max={4}
              step={0.5}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => `${v}`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.contourSmoothing"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.contourSmoothing")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={1}
              min={0}
              max={1.3}
              step={0.1}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => v.toFixed(1)}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.contourNcontours"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.contourNcontours")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={0}
              min={0}
              max={40}
              step={1}
              onCommit={(v) => field.onChange(v)}
              // 0 = auto (Plotly picks); show a hint so the floor reads.
              formatBadge={(v) => (v === 0 ? t("workspace.style.nbinsAuto") : `${v}`)}
            />
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.contourColor")}>
        <ColorscalePicker form={form} name="config.contourColorscale" />

        <FormField
          control={form.control}
          name="config.contourReverseScale"
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
          name="config.contourShowColorbar"
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
          name="config.contourColorbarTitle"
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

export const contourStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: ContourDisplay,
  },
  {
    key: "contour",
    labelKey: "workspace.style.contourOptions",
    icon: Map,
    Component: ContourOptions,
  },
];
