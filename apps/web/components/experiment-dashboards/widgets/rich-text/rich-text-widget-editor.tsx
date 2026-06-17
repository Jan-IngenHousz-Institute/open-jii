"use client";

import { Pencil } from "lucide-react";
import { useFormContext } from "react-hook-form";

import type { RichTextWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { RichTextarea } from "@repo/ui/components/rich-textarea";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import { WidgetEmptyState } from "../shell/widget-empty-state";

interface RichTextWidgetEditorProps {
  widget: RichTextWidget;
  widgetIndex: number;
  isSelected: boolean;
}

export function RichTextWidgetEditor({
  widget,
  widgetIndex,
  isSelected,
}: RichTextWidgetEditorProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();
  const html = widget.config.html;
  const isEmpty = html.trim() === "" || html === "<p><br></p>";

  if (isSelected) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-3">
        <RichTextarea
          value={html}
          onChange={(next) =>
            form.setValue(`widgets.${widgetIndex}.config.html`, next, { shouldDirty: true })
          }
          placeholder={t("editor.richTextConfig.placeholder")}
          autoFocus
          releaseTabKey
          compact
        />
      </div>
    );
  }

  if (isEmpty) {
    return <WidgetEmptyState icon={Pencil} title={t("editor.richTextConfig.emptyHint")} />;
  }

  return (
    <div className="h-full overflow-auto p-4">
      <RichTextRenderer content={html} />
    </div>
  );
}
