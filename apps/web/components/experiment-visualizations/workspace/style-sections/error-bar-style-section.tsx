"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { FormField } from "@repo/ui/components/form";
import { FormSlider } from "@repo/ui/components/form-slider";
import { Separator } from "@repo/ui/components/separator";

import type { ChartFormValues } from "../../charts/chart-config";
import { CollapsibleStyleSection } from "./shared/collapsible-style-section";

interface ErrorBarStyleSectionProps {
  form: UseFormReturn<ChartFormValues>;
  flat?: boolean;
}

/**
 * Style controls for per-series error bars. Renders only when at least
 * one Y data source has an `errorColumn` set.
 */
export function ErrorBarStyleSection({ form, flat = false }: ErrorBarStyleSectionProps) {
  const { t } = useTranslation("experimentVisualizations");
  const dataSources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  // Only Y-role data sources actually emit error bars at render time, so an
  // `errorColumn` set on an X / color / size source must not unlock these
  // styling controls. Match the renderer's filter.
  const hasAnyYErrorColumn = dataSources.some(
    (ds) => ds.role === "y" && typeof ds.errorColumn === "string" && ds.errorColumn.length > 0,
  );
  if (!hasAnyYErrorColumn) {
    return null;
  }

  return (
    <>
      <CollapsibleStyleSection title={t("workspace.style.errorBarOptions")} flat={flat}>
        <FormField
          control={form.control}
          name="config.errorBarThickness"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.errorBarThickness")}
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
          name="config.errorBarCapWidth"
          render={({ field }) => (
            <FormSlider
              label={t("workspace.style.errorBarCapWidth")}
              value={typeof field.value === "number" ? field.value : undefined}
              fallback={4}
              min={0}
              max={12}
              step={1}
              onCommit={field.onChange}
              formatBadge={(v) => `${v}px`}
            />
          )}
        />
      </CollapsibleStyleSection>
      <Separator />
    </>
  );
}
