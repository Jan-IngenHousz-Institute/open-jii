"use client";

import { Radar, Settings2 } from "lucide-react";
import { useId } from "react";

import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@repo/ui/components/form";
import { FormSlider } from "@repo/ui/components/form-slider";

import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function RadarDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function RadarOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const fillId = useId();
  const showMarkersId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.radarOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.radarFill"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={fillId}
                checked={field.value !== false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={fillId} className="text-xs font-medium">
              {t("workspace.style.radarFill")}
            </FormLabel>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.radarFillOpacity"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.radarFillOpacity")}
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={0.4}
            min={0.05}
            max={1}
            step={0.05}
            onCommit={(v) => field.onChange(v)}
            formatBadge={(v) => v.toFixed(2)}
          />
        )}
      />

      <FormField
        control={form.control}
        name="config.radarLineWidth"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.radarLineWidth")}
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={2}
            min={0.5}
            max={5}
            step={0.5}
            onCommit={(v) => field.onChange(v)}
            formatBadge={(v) => `${v}`}
          />
        )}
      />

      <FormField
        control={form.control}
        name="config.radarShowMarkers"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={showMarkersId}
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={showMarkersId} className="text-xs font-medium">
              {t("workspace.style.radarShowMarkers")}
            </FormLabel>
          </FormItem>
        )}
      />
    </CollapsibleStyleSection>
  );
}

export const radarStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: RadarDisplay,
  },
  {
    key: "radar",
    labelKey: "workspace.style.radarOptions",
    icon: Radar,
    Component: RadarOptions,
  },
];
