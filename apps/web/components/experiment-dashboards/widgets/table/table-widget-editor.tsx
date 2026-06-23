"use client";

import { Table2 } from "lucide-react";

import type { ExperimentTableWidget } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { TableWidgetView } from "./table-widget";

interface TableWidgetEditorProps {
  widget: ExperimentTableWidget;
  experimentId: string;
}

export function TableWidgetEditor({ widget, experimentId }: TableWidgetEditorProps) {
  const { t } = useTranslation("experimentDashboards");
  const tableName = widget.config.tableName;

  if (!tableName) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="bg-muted/40 flex size-10 items-center justify-center rounded-full">
          <Table2 className="size-5" />
        </div>
        <div className="text-foreground text-sm font-medium">
          {t("editor.tableConfig.pickTable")}
        </div>
        <p className="text-xs">{t("editor.tableConfig.pickHint")}</p>
      </div>
    );
  }

  return <TableWidgetView widget={widget} experimentId={experimentId} />;
}
