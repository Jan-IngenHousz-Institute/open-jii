"use client";

import { ListOrdered } from "lucide-react";
import { useFormContext } from "react-hook-form";

import type { TableWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { DashboardFormValues } from "../../../dashboard-form-shell";
import type { StripOverflowItem } from "../strip-overflow-list";
import { StripOverflowList } from "../strip-overflow-list";
import { StripPopoverControl } from "../strip-popover-control";
import { WidgetDisplayPopover } from "./widget-display-popover";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface TableWidgetStripProps {
  widget: TableWidget;
  widgetIndex: number;
}

/**
 * Table-widget Widget section: display popover + page-size popover.
 */
export function TableWidgetStrip({ widget, widgetIndex }: TableWidgetStripProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();

  const setConfig = (next: Partial<TableWidget["config"]>) => {
    form.setValue(
      `widgets.${widgetIndex}.config`,
      { ...widget.config, ...next },
      { shouldDirty: true },
    );
  };

  const handlePageSizeChange = (value: string) => {
    const next = PAGE_SIZE_OPTIONS.find((size) => String(size) === value);
    if (next) setConfig({ pageSize: next });
  };

  const items: StripOverflowItem[] = [
    {
      key: "display",
      node: (
        <WidgetDisplayPopover
          widgetId={widget.id}
          showTitle={widget.config.showTitle}
          showDescription={widget.config.showDescription}
          title={widget.config.title ?? ""}
          description={widget.config.description ?? ""}
          onShowTitleChange={(value) => setConfig({ showTitle: value })}
          onShowDescriptionChange={(value) => setConfig({ showDescription: value })}
          onTitleChange={(value) => setConfig({ title: value || undefined })}
          onDescriptionChange={(value) => setConfig({ description: value || undefined })}
        />
      ),
    },
    {
      key: "pageSize",
      node: (
        <StripPopoverControl
          label={t("editor.tableConfig.pageSize")}
          summary={String(widget.config.pageSize)}
          icon={ListOrdered}
        >
          <Select value={String(widget.config.pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StripPopoverControl>
      ),
    },
  ];

  return <StripOverflowList items={items} />;
}
