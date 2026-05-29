"use client";

import { Compass, Settings2 } from "lucide-react";
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

function PolarDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function PolarOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const fillId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.polarOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.polarMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.polarMode")}</FormLabel>
            <Select value={String(field.value ?? "markers")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="markers">{t("workspace.style.polarModes.markers")}</SelectItem>
                <SelectItem value="lines">{t("workspace.style.polarModes.lines")}</SelectItem>
                <SelectItem value="lines+markers">
                  {t("workspace.style.polarModes.linesMarkers")}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.polarMarkerSize"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.polarMarkerSize")}
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={6}
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
        name="config.polarLineWidth"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.polarLineWidth")}
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
        name="config.polarFill"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={fillId}
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={fillId} className="text-xs font-medium">
              {t("workspace.style.polarFill")}
            </FormLabel>
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.polarLayout")}>
        <FormField
          control={form.control}
          name="config.polarDirection"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.polarDirection")}
              </FormLabel>
              <Select value={String(field.value ?? "clockwise")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="clockwise">
                    {t("workspace.style.polarDirections.clockwise")}
                  </SelectItem>
                  <SelectItem value="counterclockwise">
                    {t("workspace.style.polarDirections.counterclockwise")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.polarStartAngle"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.polarStartAngle")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={90}
              min={0}
              max={360}
              step={15}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => `${v}°`}
            />
          )}
        />
      </StyleSubsection>
    </CollapsibleStyleSection>
  );
}

export const polarStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: PolarDisplay,
  },
  {
    key: "polar",
    labelKey: "workspace.style.polarOptions",
    icon: Compass,
    Component: PolarOptions,
  },
];
