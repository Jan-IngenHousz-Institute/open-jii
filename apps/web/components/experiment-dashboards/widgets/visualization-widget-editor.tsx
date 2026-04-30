"use client";

import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useLocale } from "@/hooks/useLocale";
import { BarChart3, ExternalLink, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormContext } from "react-hook-form";

import type { VisualizationWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@repo/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { DashboardFormValues } from "../editor/dashboard-form-values";
import { VisualizationWidgetView } from "./visualization-widget";
import { WidgetActions } from "./widget-actions";

interface VisualizationWidgetEditorProps {
  widget: VisualizationWidget;
  experimentId: string;
  widgetIndex: number;
  onRemove: () => void;
}

/**
 * Editor variant: when no visualization is picked, the picker fills the
 * body. Once configured, we delegate to the read-only view and float a
 * kebab in the corner that swaps the chart, toggles title/description,
 * and removes the widget. No side-panel — every control lives inside the
 * widget.
 */
export function VisualizationWidgetEditor({
  widget,
  experimentId,
  widgetIndex,
  onRemove,
}: VisualizationWidgetEditorProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();
  const visualizationId = widget.config.visualizationId;

  const setConfig = (next: Partial<VisualizationWidget["config"]>) => {
    form.setValue(
      `widgets.${widgetIndex}.config`,
      { ...widget.config, ...next },
      { shouldDirty: true },
    );
  };

  if (!visualizationId) {
    return (
      <PickerBody
        experimentId={experimentId}
        onPick={(id) => setConfig({ visualizationId: id })}
        onRemove={onRemove}
      />
    );
  }

  return (
    <>
      <ConfiguredActions
        experimentId={experimentId}
        widget={widget}
        onPick={(id) => setConfig({ visualizationId: id })}
        onToggleTitle={() => setConfig({ showTitle: !(widget.config.showTitle ?? true) })}
        onToggleDescription={() =>
          setConfig({ showDescription: !(widget.config.showDescription ?? false) })
        }
        onRemove={onRemove}
      />
      <VisualizationWidgetView widget={widget} experimentId={experimentId} />
    </>
  );
}

interface PickerBodyProps {
  experimentId: string;
  onPick: (visualizationId: string) => void;
  onRemove: () => void;
}

function PickerBody({ experimentId, onPick, onRemove }: PickerBodyProps) {
  const { t } = useTranslation("experimentDashboards");
  const locale = useLocale();
  const { data, isLoading } = useExperimentVisualizations({ experimentId });
  const visualizations = data?.body ?? [];
  const newVizHref = `/${locale}/platform/experiments/${experimentId}/analysis/visualizations`;
  const hasVisualizations = visualizations.length > 0;

  return (
    <>
      <WidgetActions ariaLabel={t("editor.inspector.title")}>
        <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 size-4" />
          {t("editor.inspector.delete")}
        </DropdownMenuItem>
      </WidgetActions>
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="bg-muted/40 text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <BarChart3 className="size-6" />
        </div>
        <div className="space-y-1">
          <div className="text-foreground text-sm font-semibold">
            {t("editor.visualizationConfig.pickVisualization")}
          </div>
          <p className="text-muted-foreground text-xs">
            {hasVisualizations
              ? t(
                  "editor.visualizationConfig.pickHelp",
                  "Choose an existing chart to embed in this widget.",
                )
              : t(
                  "editor.visualizationConfig.noneHelp",
                  "Create a chart in the Visualizations tab, then come back to embed it.",
                )}
          </p>
        </div>
        <Select
          value=""
          onValueChange={(value) => {
            if (value) onPick(value);
          }}
          disabled={isLoading || !hasVisualizations}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue
              placeholder={
                hasVisualizations
                  ? t("editor.visualizationConfig.pickVisualization")
                  : t("editor.visualizationConfig.noneAvailable")
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
        <Button asChild variant="link" size="sm">
          <Link href={newVizHref} target="_blank" rel="noreferrer">
            <Plus className="mr-1 size-3" />
            {t("editor.visualizationConfig.newVisualization")}
          </Link>
        </Button>
      </div>
    </>
  );
}

interface ConfiguredActionsProps {
  experimentId: string;
  widget: VisualizationWidget;
  onPick: (visualizationId: string) => void;
  onToggleTitle: () => void;
  onToggleDescription: () => void;
  onRemove: () => void;
}

function ConfiguredActions({
  experimentId,
  widget,
  onPick,
  onToggleTitle,
  onToggleDescription,
  onRemove,
}: ConfiguredActionsProps) {
  const { t } = useTranslation("experimentDashboards");
  const locale = useLocale();
  const { data } = useExperimentVisualizations({ experimentId });
  const visualizations = data?.body ?? [];
  const showTitle = widget.config.showTitle ?? true;
  const showDescription = widget.config.showDescription ?? false;
  const editVizHref = widget.config.visualizationId
    ? `/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${widget.config.visualizationId}`
    : null;

  return (
    <WidgetActions ariaLabel={t("editor.inspector.title")}>
      <DropdownMenuLabel className="text-muted-foreground text-xs">
        {t("editor.visualizationConfig.pickVisualization")}
      </DropdownMenuLabel>
      {visualizations.length === 0 ? (
        <DropdownMenuItem disabled>
          {t("editor.visualizationConfig.noneAvailable")}
        </DropdownMenuItem>
      ) : (
        // Inline visualization swap — no popover, just a select hosted in
        // the dropdown menu item area.
        <div className="px-1.5 pb-1">
          <Select
            value={widget.config.visualizationId ?? ""}
            onValueChange={(value) => onPick(value)}
          >
            <SelectTrigger>
              <SelectValue />
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
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onToggleTitle}>
        {showTitle ? (
          <EyeOff className="mr-2 size-4" />
        ) : (
          <Eye className="mr-2 size-4" />
        )}
        {showTitle
          ? t("editor.visualizationConfig.hideTitle", "Hide title")
          : t("editor.visualizationConfig.showTitle")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onToggleDescription}>
        {showDescription ? (
          <EyeOff className="mr-2 size-4" />
        ) : (
          <Eye className="mr-2 size-4" />
        )}
        {showDescription
          ? t("editor.visualizationConfig.hideDescription", "Hide description")
          : t("editor.visualizationConfig.showDescription")}
      </DropdownMenuItem>
      {editVizHref && (
        <DropdownMenuItem asChild>
          <Link href={editVizHref} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 size-4" />
            {t("editor.visualizationConfig.openInEditor")}
          </Link>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
        <Trash2 className="mr-2 size-4" />
        {t("editor.inspector.delete")}
      </DropdownMenuItem>
    </WidgetActions>
  );
}
