"use client";

import { LayoutGrid, Minus, Settings2, Waves } from "lucide-react";
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
import type { ChartPanelProps, ShelfDef } from "../../../types";

function ViolinDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function ViolinOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const showBoxId = useId();
  const showMeanlineId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.violinOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.violinOrientation"
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
        name="config.violinmode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.violinmode")}</FormLabel>
            <Select value={String(field.value ?? "group")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="group">{t("workspace.boxmodes.group")}</SelectItem>
                <SelectItem value="overlay">{t("workspace.boxmodes.overlay")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.violinSide"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.violinSide")}</FormLabel>
            <Select value={String(field.value ?? "both")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="both">{t("workspace.violinSides.both")}</SelectItem>
                <SelectItem value="positive">{t("workspace.violinSides.positive")}</SelectItem>
                <SelectItem value="negative">{t("workspace.violinSides.negative")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.violinScalemode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.violinScalemode")}
            </FormLabel>
            <Select value={String(field.value ?? "width")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="width">{t("workspace.violinScalemodes.width")}</SelectItem>
                <SelectItem value="count">{t("workspace.violinScalemodes.count")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.violinOverlay")}>
        <FormField
          control={form.control}
          name="config.violinShowBox"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showBoxId}
                  // The default is on; treat undefined as checked so the
                  // control reflects the rendered state on first paint.
                  checked={field.value !== false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showBoxId} className="text-xs font-medium">
                {t("workspace.style.violinShowBox")}
              </FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.violinShowMeanline"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={showMeanlineId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={showMeanlineId} className="text-xs font-medium">
                {t("workspace.style.violinShowMeanline")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.boxPointsSubsection")}>
        <FormField
          control={form.control}
          name="config.violinPoints"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.boxpoints")}
              </FormLabel>
              <Select value={String(field.value ?? "outliers")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="outliers">{t("workspace.boxpoints.outliers")}</SelectItem>
                  <SelectItem value="suspectedoutliers">
                    {t("workspace.boxpoints.suspectedoutliers")}
                  </SelectItem>
                  <SelectItem value="all">{t("workspace.boxpoints.all")}</SelectItem>
                  <SelectItem value="false">
                    <span className="text-muted-foreground italic">
                      {t("workspace.boxpoints.none")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
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

function ViolinReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

function ViolinFacetStyle({ form, flat }: ChartPanelProps) {
  return <FacetStyleSection form={form} flat={flat} />;
}

export const violinPlotStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: ViolinDisplay,
  },
  {
    key: "violin",
    labelKey: "workspace.style.violinOptions",
    icon: Waves,
    Component: ViolinOptions,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: ViolinReferenceLines,
  },
  {
    key: "facet",
    labelKey: "workspace.style.facetOptions",
    icon: LayoutGrid,
    Component: ViolinFacetStyle,
  },
];
