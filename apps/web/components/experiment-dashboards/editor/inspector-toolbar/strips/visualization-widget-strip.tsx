"use client";

import { useExperimentVisualizationCreate } from "@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useLocale } from "@/hooks/useLocale";
import { ExternalLink, Loader2, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useFormContext } from "react-hook-form";

import type { VisualizationWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";

import { lineChartType } from "../../../../experiment-visualizations/charts/basic/line";
import type { DashboardFormValues } from "../../../dashboard-form-shell";
import type { StripOverflowItem } from "../strip-overflow-list";
import { StripOverflowList } from "../strip-overflow-list";
import { StripPopoverControl } from "../strip-popover-control";
import { WidgetDisplayPopover } from "./widget-display-popover";

interface VisualizationWidgetStripProps {
  widget: VisualizationWidget;
  widgetIndex: number;
  experimentId: string;
}

// Viz-widget Widget section: viz picker, display popover, open-in-editor link.
// Chart-type picker lives on the toolbar's left identity island, not here.
export function VisualizationWidgetStrip({
  widget,
  widgetIndex,
  experimentId,
}: VisualizationWidgetStripProps) {
  const { t } = useTranslation("experimentDashboards");
  const locale = useLocale();
  const form = useFormContext<DashboardFormValues>();
  const { data, isLoading } = useExperimentVisualizations({ experimentId });
  const visualizations = data?.body ?? [];

  const setConfig = (next: Partial<VisualizationWidget["config"]>) => {
    form.setValue(
      `widgets.${widgetIndex}.config`,
      { ...widget.config, ...next },
      { shouldDirty: true },
    );
  };

  const { mutate: createVisualization, isPending: isCreating } = useExperimentVisualizationCreate({
    experimentId,
    onSuccess: (created) => {
      setConfig({ visualizationId: created.id });
    },
  });

  const handleCreateNew = () => {
    const defaultName = `${t("editor.visualizationConfig.untitledViz")} - ${new Date().toLocaleDateString(
      locale,
      { month: "short", day: "numeric", year: "numeric" },
    )}`;
    createVisualization({
      params: { id: experimentId },
      body: {
        name: defaultName,
        chartFamily: lineChartType.family,
        chartType: lineChartType.type,
        config: { ...lineChartType.defaultConfig() },
        dataConfig: lineChartType.defaultDataConfig(),
      },
    });
  };

  const visualizationId = widget.config.visualizationId;
  const linkedViz = visualizations.find((v) => v.id === visualizationId);
  const linkedVizName = linkedViz?.name;
  const editVizHref = visualizationId
    ? `/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${visualizationId}`
    : null;

  const items: StripOverflowItem[] = [
    {
      key: "visualization",
      node: (
        <StripPopoverControl
          label={t("editor.inspector.visualization")}
          summary={linkedVizName}
          icon={Settings2}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("editor.inspector.visualization")}</Label>
              <Select
                value={visualizationId ?? ""}
                onValueChange={(value) => setConfig({ visualizationId: value })}
                disabled={isLoading || visualizations.length === 0}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue
                    placeholder={
                      visualizations.length === 0
                        ? t("editor.visualizationConfig.noneAvailable")
                        : t("editor.visualizationConfig.pickVisualization")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {visualizations.map((viz) => (
                    <SelectItem key={viz.id} value={viz.id}>
                      {viz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 w-full justify-start px-1.5"
              onClick={handleCreateNew}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              <span className="text-xs">{t("editor.visualizationConfig.newVisualization")}</span>
            </Button>
          </div>
        </StripPopoverControl>
      ),
    },
    {
      key: "display",
      node: (
        <WidgetDisplayPopover
          widgetId={widget.id}
          showTitle={widget.config.showTitle}
          showDescription={widget.config.showDescription}
          title={widget.config.title ?? ""}
          description={widget.config.description ?? ""}
          titlePlaceholder={linkedVizName ?? undefined}
          descriptionPlaceholder={linkedViz?.description ?? undefined}
          onShowTitleChange={(value) => setConfig({ showTitle: value })}
          onShowDescriptionChange={(value) => setConfig({ showDescription: value })}
          onTitleChange={(value) => setConfig({ title: value || undefined })}
          onDescriptionChange={(value) => setConfig({ description: value || undefined })}
        />
      ),
    },
    ...(editVizHref
      ? [
          {
            key: "edit-link",
            node: (
              <Button
                asChild
                variant="ghost"
                size="sm"
                aria-label={t("editor.visualizationConfig.editVisualization")}
                className="text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-full px-2.5 text-xs"
              >
                <Link href={editVizHref}>
                  <ExternalLink className="size-3.5" />
                  <span className="hidden md:inline">
                    {t("editor.visualizationConfig.editVisualization")}
                  </span>
                </Link>
              </Button>
            ),
          } satisfies StripOverflowItem,
        ]
      : []),
  ];

  return <StripOverflowList items={items} />;
}
