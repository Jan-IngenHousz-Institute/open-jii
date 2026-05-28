"use client";

import { Candy, Minus, MoveVertical, Settings2 } from "lucide-react";

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
import { ErrorBarStyleSection } from "../../../../workspace/style-sections/error-bar-style-section";
import { ReferenceLinesSection } from "../../../../workspace/style-sections/reference-lines-section";
import { CollapsibleStyleSection } from "../../../../workspace/style-sections/shared/collapsible-style-section";
import { StyleSubsection } from "../../../../workspace/style-sections/shared/style-subsection";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function LollipopDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function LollipopOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <CollapsibleStyleSection title={t("workspace.style.lollipopOptions")} flat={flat}>
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

      <StyleSubsection title={t("workspace.style.markerSubsection")}>
        <FormField
          control={form.control}
          name="config.marker.size"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.dotSize")}
              // marker.size is `number | number[]` in Plotly's types; the
              // slider only edits the scalar form.
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={12}
              min={4}
              max={30}
              step={1}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.stemSubsection")}>
        <FormField
          control={form.control}
          name="config.stemWidth"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.stemWidth")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={2}
              min={1}
              max={6}
              step={1}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />
      </StyleSubsection>
    </CollapsibleStyleSection>
  );
}

function LollipopErrorBar({ form, flat }: ChartPanelProps) {
  return <ErrorBarStyleSection form={form} flat={flat} />;
}

function LollipopReferenceLines({ form, flat }: ChartPanelProps) {
  return <ReferenceLinesSection form={form} flat={flat} />;
}

export const lollipopStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: LollipopDisplay,
  },
  {
    key: "lollipop",
    labelKey: "workspace.style.lollipopOptions",
    icon: Candy,
    Component: LollipopOptions,
  },
  {
    key: "errorBar",
    labelKey: "workspace.style.errorBarOptions",
    icon: MoveVertical,
    Component: LollipopErrorBar,
  },
  {
    key: "referenceLines",
    labelKey: "workspace.style.referenceLines",
    icon: Minus,
    Component: LollipopReferenceLines,
  },
];
