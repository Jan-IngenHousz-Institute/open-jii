"use client";

import { AlignVerticalJustifyCenter, Settings2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { FormField } from "@repo/ui/components/form";
import { FormSlider } from "@repo/ui/components/form-slider";

import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function ParcoordsDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} hideLegend flat={flat} />;
}

function ParcoordsOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Only line-styling knobs live here; colorscale / reverseScale /
  // showColorbar / colorbarTitle are owned by the Color dimension shelf
  // on the Data tab.
  return (
    <CollapsibleStyleSection title={t("workspace.style.parcoordsOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.parcoordsLineWidth"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.parcoordsLineWidth")}
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
        name="config.parcoordsLineOpacity"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.parcoordsLineOpacity")}
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={0.5}
            min={0.05}
            max={1}
            step={0.05}
            onCommit={(v) => field.onChange(v)}
            formatBadge={(v) => v.toFixed(2)}
          />
        )}
      />
    </CollapsibleStyleSection>
  );
}

export const parallelCoordinatesStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: ParcoordsDisplay,
  },
  {
    key: "parcoords",
    labelKey: "workspace.style.parcoordsOptions",
    icon: AlignVerticalJustifyCenter,
    Component: ParcoordsOptions,
  },
];
