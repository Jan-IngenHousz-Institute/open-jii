"use client";

import type { UseFormReturn } from "react-hook-form";

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

import type { ChartFormValues } from "../../charts/chart-config";
import { CollapsibleStyleSection } from "./shared/collapsible-style-section";

interface AreaStyleSectionProps {
  form: UseFormReturn<ChartFormValues>;
  titleKey?: string;
  defaultTitle?: string;
  flat?: boolean;
}

/**
 * Reusable area-shape style controls: stack mode + fill opacity. Line and
 * marker subsections live in `LineStyleSection` / `MarkerStyleSection`.
 */
export function AreaStyleSection({
  form,
  titleKey = "workspace.style.areaOptions",
  defaultTitle,
  flat = false,
}: AreaStyleSectionProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <CollapsibleStyleSection title={t(titleKey, defaultTitle ?? "Area options")} flat={flat}>
      <FormField
        control={form.control}
        name="config.stackMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.style.stackMode")}</FormLabel>
            <Select value={String(field.value ?? "none")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">
                    {t("workspace.stackModes.none")}
                  </span>
                </SelectItem>
                <SelectItem value="stacked">{t("workspace.stackModes.stacked")}</SelectItem>
                <SelectItem value="percent">{t("workspace.stackModes.percent")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.fillOpacity"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.fillOpacity")}
            value={typeof field.value === "number" ? field.value : undefined}
            fallback={0.4}
            min={0.05}
            max={1}
            step={0.05}
            onCommit={field.onChange}
            formatBadge={(v) => `${Math.round(v * 100)}%`}
          />
        )}
      />
    </CollapsibleStyleSection>
  );
}
