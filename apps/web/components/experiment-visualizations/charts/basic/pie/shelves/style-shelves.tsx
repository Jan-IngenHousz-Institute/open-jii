"use client";

import { PieChart, Settings2 } from "lucide-react";
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

function PieDisplay({ form, flat }: ChartPanelProps) {
  return <DisplayOptionsSection form={form} flat={flat} />;
}

function PieOptions({ form, flat }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");
  const sortSlicesId = useId();

  return (
    <CollapsibleStyleSection title={t("workspace.style.pieOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.hole"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.pieHole")}
            // Donut hole as a fraction of the radius. The wrapper passes
            // `hole > 0` as a donut; this slider exposes the same scalar.
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={0}
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
        name="config.textinfo"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.pieTextInfo")}
            </FormLabel>
            <Select value={String(field.value ?? "percent")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="percent">{t("workspace.textinfos.percent")}</SelectItem>
                <SelectItem value="value">{t("workspace.textinfos.value")}</SelectItem>
                <SelectItem value="label">{t("workspace.textinfos.label")}</SelectItem>
                <SelectItem value="label+percent">
                  {t("workspace.textinfos.labelPercent")}
                </SelectItem>
                <SelectItem value="label+value">{t("workspace.textinfos.labelValue")}</SelectItem>
                <SelectItem value="value+percent">
                  {t("workspace.textinfos.valuePercent")}
                </SelectItem>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">
                    {t("workspace.textinfos.none")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.pieTextPosition"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.pieTextPosition")}
            </FormLabel>
            <Select value={String(field.value ?? "auto")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="auto">{t("workspace.pieTextPositions.auto")}</SelectItem>
                <SelectItem value="inside">{t("workspace.pieTextPositions.inside")}</SelectItem>
                <SelectItem value="outside">{t("workspace.pieTextPositions.outside")}</SelectItem>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">
                    {t("workspace.pieTextPositions.none")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <StyleSubsection title={t("workspace.style.pieOrderingSubsection")}>
        <FormField
          control={form.control}
          name="config.sortSlices"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={sortSlicesId}
                  // Wrapper defaults `sort` to true; treat undefined as
                  // checked so the control reflects the rendered state.
                  checked={field.value !== false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={sortSlicesId} className="text-xs font-medium">
                {t("workspace.style.pieSortSlices")}
              </FormLabel>
            </FormItem>
          )}
        />
      </StyleSubsection>
    </CollapsibleStyleSection>
  );
}

export const pieStyleShelves: ShelfDef[] = [
  {
    key: "display",
    labelKey: "workspace.style.display",
    icon: Settings2,
    Component: PieDisplay,
  },
  {
    key: "pie",
    labelKey: "workspace.style.pieOptions",
    icon: PieChart,
    Component: PieOptions,
  },
];
