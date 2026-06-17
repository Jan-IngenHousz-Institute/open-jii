"use client";

import { Columns3, LayoutGrid, Minus, Settings2 } from "lucide-react";
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

function BoxPlotDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function BoxPlotOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const notchedId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.boxOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.boxOrientation"
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
        name="config.boxmode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.boxmode")}</FormLabel>
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

      <StyleSubsection title={t("workspace.style.boxStatistics")}>
        <FormField
          control={form.control}
          name="config.boxmean"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.style.boxmean")}</FormLabel>
              <Select value={String(field.value ?? "false")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="false">
                    <span className="text-muted-foreground italic">
                      {t("workspace.boxmeans.off")}
                    </span>
                  </SelectItem>
                  <SelectItem value="true">{t("workspace.boxmeans.mean")}</SelectItem>
                  <SelectItem value="sd">{t("workspace.boxmeans.sd")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.notched"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={notchedId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={notchedId} className="text-xs font-medium">
                {t("workspace.style.notched")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.boxPointsSubsection")}>
        <FormField
          control={form.control}
          name="config.boxpoints"
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

function BoxPlotReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

function BoxPlotFacetStyle({ form, flat }: ChartPanelProps) {
  return <FacetStyleSection form={form} flat={flat} />;
}

export const boxPlotStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: BoxPlotDisplay,
  },
  {
    key: "box",
    labelKey: "workspace.style.boxOptions",
    icon: Columns3,
    Component: BoxPlotOptions,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: BoxPlotReferenceLines,
  },
  {
    key: "facet",
    labelKey: "workspace.style.facetOptions",
    icon: LayoutGrid,
    Component: BoxPlotFacetStyle,
    visible: hasFacetSource,
  },
];
