"use client";

import { useTranslation } from "@repo/i18n";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";

import { DisplayOptionsSection } from "../../workspace/style-sections/display-options-section";
import { StyleSubsection } from "../../workspace/style-sections/style-subsection";
import type { ChartPanelProps } from "../types";

const SORT_VALUE_NONE = "__none__";

export function BarStylePanel({ form }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  return (
    <div className="space-y-6">
      <DisplayOptionsSection form={form} />
      <Separator />

      <section className="space-y-5">
        <h3 className="text-sm font-semibold">{t("workspace.style.barOptions", "Bar options")}</h3>

        <StyleSubsection title={t("workspace.bar.layoutSubsection", "Layout")}>
          <FormField
            control={form.control}
            name="config.orientation"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">{t("workspace.bar.orientation")}</FormLabel>
                <Select value={String(field.value ?? "v")} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="v">
                      {t("workspace.bar.orientations.vertical", "Vertical")}
                    </SelectItem>
                    <SelectItem value="h">
                      {t("workspace.bar.orientations.horizontal", "Horizontal")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </StyleSubsection>

        <StyleSubsection title={t("workspace.bar.rankingSubsection", "Ranking")}>
          <FormField
            control={form.control}
            name="config.sortDirection"
            render={({ field }) => {
              // Radix Select doesn't accept null/undefined as a value, so we
              // map null ⇄ a sentinel string at the boundary. The form
              // still stores null for "preserve insertion order".
              const fieldValue = field.value;
              const selectValue =
                fieldValue === "asc" || fieldValue === "desc" ? fieldValue : SORT_VALUE_NONE;
              return (
                <FormItem>
                  <FormLabel className="text-xs font-medium">
                    {t("workspace.bar.sortDirection")}
                  </FormLabel>
                  <Select
                    value={selectValue}
                    onValueChange={(value) =>
                      field.onChange(value === SORT_VALUE_NONE ? null : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SORT_VALUE_NONE}>
                        {t("workspace.bar.sortOptions.none", "None")}
                      </SelectItem>
                      <SelectItem value="desc">
                        {t("workspace.bar.sortOptions.desc", "Highest first")}
                      </SelectItem>
                      <SelectItem value="asc">
                        {t("workspace.bar.sortOptions.asc", "Lowest first")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="config.topN"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.bar.topN", "Show top N")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder={t("workspace.bar.topNPlaceholder", "All")}
                    value={typeof field.value === "number" ? String(field.value) : ""}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw === "") {
                        field.onChange(undefined);
                        return;
                      }
                      const parsed = Number(raw);
                      field.onChange(Number.isFinite(parsed) ? parsed : undefined);
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </StyleSubsection>
      </section>
    </div>
  );
}
