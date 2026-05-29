"use client";

import { Settings2, Triangle } from "lucide-react";

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

import { DisplayOptionsSection } from "../../../../workspace/style-sections/display-options-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import { StyleSubsection } from "../../../../workspace/style-sections/shared/style-subsection";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function TernaryDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function TernaryOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <CollapsibleStyleSection title={t("workspace.style.ternaryOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.ternaryMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.ternaryMode")}
            </FormLabel>
            <Select value={String(field.value ?? "markers")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="markers">{t("workspace.style.ternaryModes.markers")}</SelectItem>
                <SelectItem value="lines">{t("workspace.style.ternaryModes.lines")}</SelectItem>
                <SelectItem value="lines+markers">
                  {t("workspace.style.ternaryModes.linesMarkers")}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.ternaryMarkerSize"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.ternaryMarkerSize")}
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={7}
            min={2}
            max={20}
            step={1}
            onCommit={(v) => field.onChange(v)}
            formatBadge={(v) => `${v}`}
          />
        )}
      />

      <FormField
        control={form.control}
        name="config.ternaryLineWidth"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.ternaryLineWidth")}
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

      <StyleSubsection title={t("workspace.style.ternaryNormalization")}>
        <FormField
          control={form.control}
          name="config.ternarySum"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.ternarySum")}
              </FormLabel>
              <Select
                value={String(field.value ?? 100)}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="100">{t("workspace.style.ternarySums.percent")}</SelectItem>
                  <SelectItem value="1">{t("workspace.style.ternarySums.fraction")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </StyleSubsection>
    </CollapsibleStyleSection>
  );
}

export const ternaryStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: TernaryDisplay,
  },
  {
    key: "ternary",
    labelKey: "workspace.style.ternaryOptions",
    icon: Triangle,
    Component: TernaryOptions,
  },
];
