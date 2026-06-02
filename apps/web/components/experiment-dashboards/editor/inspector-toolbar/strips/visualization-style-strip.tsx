"use client";

import { Palette } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import type { ChartFormValues } from "../../../../experiment-visualizations/charts/chart-config";
import { getChartTypeDef } from "../../../../experiment-visualizations/charts/chart-registry";
import type { StripOverflowItem } from "../strip-overflow-list";
import { StripOverflowList } from "../strip-overflow-list";
import { StripPopoverControl } from "../strip-popover-control";

interface VisualizationStyleStripProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
}

export function VisualizationStyleStrip({ form, columns }: VisualizationStyleStripProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tViz } = useTranslation("experimentVisualizations");
  const chartType = useWatch({ control: form.control, name: "chartType" });
  const def = getChartTypeDef(chartType);

  // Broad subscription so shelf `visible(form)` predicates re-evaluate
  // when the user changes data sources / trace types.
  useWatch({ control: form.control, name: "dataConfig.dataSources" });

  const items: StripOverflowItem[] = (() => {
    if (def.styleShelves && def.styleShelves.length > 0) {
      return def.styleShelves
        .filter((shelf) => !shelf.visible || shelf.visible(form))
        .map((shelf) => {
          const Comp = shelf.Component;
          return {
            key: shelf.key,
            node: (
              <StripPopoverControl
                label={tViz(shelf.labelKey)}
                icon={shelf.icon}
                summary={shelf.summary?.(form, tViz)}
                contentClassName="w-96"
              >
                <Comp form={form} columns={columns} flat />
              </StripPopoverControl>
            ),
          };
        });
    }

    return [
      {
        key: "style",
        node: (
          <StripPopoverControl
            label={t("editor.vizStyleStrip.style")}
            icon={Palette}
            contentClassName="w-96"
          >
            <def.StylePanel form={form} columns={columns} />
          </StripPopoverControl>
        ),
      },
    ];
  })();

  return <StripOverflowList items={items} />;
}
