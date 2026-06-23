"use client";

import { useId } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

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

import type { ChartFormValues } from "../../charts/chart-config";
import { CollapsibleStyleSection } from "./shared/collapsible-style-section";

interface FacetStyleSectionProps {
  form: UseFormReturn<ChartFormValues>;
  flat?: boolean;
}

/**
 * Style controls for the facet grid layout. Renders only when a
 * `role: "facet"` data source has been picked.
 */
export function FacetStyleSection({ form, flat = false }: FacetStyleSectionProps) {
  const { t } = useTranslation("experimentVisualizations");
  const sharedXId = useId();
  const sharedYId = useId();
  const sharedXTitleId = useId();
  const sharedYTitleId = useId();

  const dataSources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const hasFacet = dataSources.some(
    (ds) => ds.role === "facet" && typeof ds.columnName === "string" && ds.columnName.length > 0,
  );
  if (!hasFacet) {
    return null;
  }

  return (
    <CollapsibleStyleSection title={t("workspace.style.facetOptions")} flat={flat}>
      <FormField
        control={form.control}
        name="config.facetColumns"
        render={({ field }) => (
          <FormSlider
            label={t("workspace.style.facetColumns")}
            value={typeof field.value === "number" ? field.value : undefined}
            // No numeric default; `undefined` means auto (renderer
            // picks ceil(sqrt(N))).
            fallback={2}
            min={1}
            max={8}
            step={1}
            onCommit={(v) => field.onChange(v)}
            formatBadge={(v) => `${v}`}
          />
        )}
      />

      <FormField
        control={form.control}
        name="config.facetSharedX"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={sharedXId}
                // Default true: scientific facets almost always want
                // shared scales for cross-cell comparison.
                checked={field.value !== false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={sharedXId} className="text-xs font-medium">
              {t("workspace.style.facetSharedX")}
            </FormLabel>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.facetSharedY"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={sharedYId}
                checked={field.value !== false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={sharedYId} className="text-xs font-medium">
              {t("workspace.style.facetSharedY")}
            </FormLabel>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.facetSharedXTitle"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={sharedXTitleId}
                checked={field.value !== false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={sharedXTitleId} className="text-xs font-medium">
              {t("workspace.style.facetSharedXTitle")}
            </FormLabel>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.facetSharedYTitle"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                id={sharedYTitleId}
                checked={field.value !== false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <FormLabel htmlFor={sharedYTitleId} className="text-xs font-medium">
              {t("workspace.style.facetSharedYTitle")}
            </FormLabel>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="config.facetRowOrder"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">
              {t("workspace.style.facetRowOrder")}
            </FormLabel>
            <Select value={String(field.value ?? "top-to-bottom")} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="top-to-bottom">
                  {t("workspace.style.facetRowOrders.topToBottom")}
                </SelectItem>
                <SelectItem value="bottom-to-top">
                  {t("workspace.style.facetRowOrders.bottomToTop")}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </CollapsibleStyleSection>
  );
}
