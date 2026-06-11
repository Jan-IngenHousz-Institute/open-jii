"use client";

import type { Control } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../../charts/chart-config";
import { COLORSCALES } from "../../../charts/colors/colorscales";
import { ColorscaleSwatch } from "./colorscale-swatch";

export interface ContinuousColorSettingsProps {
  control: Control<ChartFormValues>;
  previewGradient: string;
  showColorbarId: string;
}

export function ContinuousColorSettings({
  control,
  previewGradient,
  showColorbarId,
}: ContinuousColorSettingsProps) {
  const { t } = useTranslation("experimentVisualizations");
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="config.marker.colorscale"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.shelves.colorScale")}
              </FormLabel>
              <Select
                value={typeof field.value === "string" ? field.value : "Viridis"}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COLORSCALES.map((cs) => (
                    <SelectItem key={cs.value} value={cs.value}>
                      <div className="flex items-center gap-3">
                        <ColorscaleSwatch gradient={cs.gradient} />
                        {t(`workspace.colorscales.${cs.translationKey}`)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="config.marker.colorbar.title.text"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.shelves.colorAxisTitle")}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t("workspace.shelves.colorAxisTitlePlaceholder")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="config.marker.colorbar.title.side"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.shelves.colorAxisTitlePosition")}
              </FormLabel>
              <Select value={String(field.value ?? "right")} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="top">{t("workspace.positions.top")}</SelectItem>
                  <SelectItem value="right">{t("workspace.positions.right")}</SelectItem>
                  <SelectItem value="bottom">{t("workspace.positions.bottom")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="config.marker.showscale"
          render={({ field }) => (
            <FormItem className="flex items-end gap-2 pb-1">
              <FormControl>
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  id={showColorbarId}
                />
              </FormControl>
              <FormLabel htmlFor={showColorbarId} className="text-xs font-medium">
                {t("workspace.shelves.showColorbar")}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="config.marker.reversescale"
        render={({ field }) => {
          const reverseScaleId = `${field.name}-checkbox`;
          return (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={reverseScaleId}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor={reverseScaleId} className="text-xs font-medium">
                {t("workspace.shelves.reverseScale")}
              </FormLabel>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <div>
        <div className="text-muted-foreground mb-1 text-xs font-medium">
          {t("workspace.shelves.preview")}
        </div>
        <ColorscaleSwatch gradient={previewGradient} className="h-5 w-full" />
      </div>
    </>
  );
}
