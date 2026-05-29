"use client";

import { Settings2, Waves } from "lucide-react";
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

function AlluvialDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} hideLegend flat={flat} />;
}

function AlluvialOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const hideLabelsId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.alluvialOptions")} flat={flat}>
      <StyleSubsection title={t("workspace.style.alluvialNodes")}>
        <FormField
          control={form.control}
          name="config.alluvialNodeThickness"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.alluvialNodeThickness")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={20}
              min={5}
              max={50}
              step={1}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />

        <FormField
          control={form.control}
          name="config.alluvialNodePadding"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.alluvialNodePadding")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={15}
              min={0}
              max={50}
              step={1}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.alluvialLinks")}>
        <FormField
          control={form.control}
          name="config.alluvialLinkOpacity"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.alluvialLinkOpacity")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={0.4}
              min={0.1}
              max={1}
              step={0.05}
              onCommit={(v) => field.onChange(v)}
              formatBadge={(v) => v.toFixed(2)}
            />
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.alluvialColor")}>
        <FormField
          control={form.control}
          name="config.alluvialColorMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.style.alluvialColorMode")}
              </FormLabel>
              <Select value={String(field.value ?? "stage")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="stage">
                    {t("workspace.style.alluvialColorModes.stage")}
                  </SelectItem>
                  <SelectItem value="value">
                    {t("workspace.style.alluvialColorModes.value")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </StyleSubsection>

      <StyleSubsection title={t("workspace.style.alluvialLabels")}>
        <FormField
          control={form.control}
          name="config.alluvialHideLabels"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={hideLabelsId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={hideLabelsId} className="text-xs font-medium">
                {t("workspace.style.alluvialHideLabels")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>
    </CollapsibleStyleSection>
  );
}

export const alluvialStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: AlluvialDisplay,
  },
  {
    key: "alluvial",
    labelKey: "workspace.style.alluvialOptions",
    icon: Waves,
    Component: AlluvialOptions,
  },
];
