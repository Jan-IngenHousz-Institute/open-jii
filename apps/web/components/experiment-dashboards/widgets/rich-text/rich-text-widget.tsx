"use client";

import { FileText } from "lucide-react";

import type { ExperimentRichTextWidget } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

import { WidgetEmptyState } from "../shell/widget-empty-state";

interface RichTextWidgetViewProps {
  widget: ExperimentRichTextWidget;
}

export function RichTextWidgetView({ widget }: RichTextWidgetViewProps) {
  const { t } = useTranslation("experimentDashboards");
  const html = widget.config.html;
  const isEmpty = html.trim() === "" || html === "<p><br></p>";

  if (isEmpty) {
    return (
      <WidgetEmptyState
        icon={FileText}
        title={t("widget.emptyRichText")}
        description={t("widget.emptyRichTextDescription")}
      />
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-4">
      <RichTextRenderer content={html} />
    </div>
  );
}
