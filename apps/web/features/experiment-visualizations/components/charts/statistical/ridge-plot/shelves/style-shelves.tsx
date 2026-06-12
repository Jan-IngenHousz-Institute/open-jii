"use client";

import { Mountain, Settings2 } from "lucide-react";
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

function RidgeDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function RidgeOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const fillId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.ridgeOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.ridgeOverlap"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.ridgeOverlap")}
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={0.5}
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
        name="config.ridgeFill"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={fillId}
                // Default-on: treat undefined as checked so the control
                // matches the rendered state on first paint.
                checked={field.value !== false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={fillId} className="text-xs font-medium">
              {t("workspace.style.ridgeFill")}
            </FormLabel>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.ridgeSortOrder"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.ridgeSortOrder")}
            </FormLabel>
            <Select value={String(field.value ?? "alphabetical")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="alphabetical">
                  {t("workspace.ridgeSortOrders.alphabetical")}
                </SelectItem>
                <SelectItem value="median">{t("workspace.ridgeSortOrders.median")}</SelectItem>
                <SelectItem value="mean">{t("workspace.ridgeSortOrders.mean")}</SelectItem>
                <SelectItem value="count">{t("workspace.ridgeSortOrders.count")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.ridgeAppearance")}>
        <FormField
          control={form.control}
          name="config.ridgeLineWidth"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.ridgeLineWidth")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={1.5}
              min={0.5}
              max={4}
              step={0.5}
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

export const ridgePlotStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: RidgeDisplay,
  },
  {
    key: "ridge",
    labelKey: "workspace.style.ridgeOptions",
    icon: Mountain,
    Component: RidgeOptions,
  },
];
