"use client";

import { FileText } from "lucide-react";

import type { RichTextWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

import { WidgetEmptyState } from "./widget-empty-state";

interface RichTextWidgetViewProps {
  widget: RichTextWidget;
}

/**
 * Rich-text widget — renders Quill-produced HTML stored on the widget. We
 * call this "Markdown" in the UI for user mental-modeling purposes, but the
 * underlying format is HTML; sanitization is handled by `RichTextRenderer`.
 *
 * Empty content is intercepted here rather than passing through to
 * `RichTextRenderer`, which would otherwise show its baked-in
 * "No description provided" string that doesn't fit the dashboard context.
 */
export function RichTextWidgetView({ widget }: RichTextWidgetViewProps) {
  const { t } = useTranslation("experimentDashboards");
  const html = widget.config.html ?? "";
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
