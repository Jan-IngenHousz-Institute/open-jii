"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";

import type { RichTextWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { DropdownMenuItem } from "@repo/ui/components/dropdown-menu";
import { RichTextarea } from "@repo/ui/components/rich-textarea";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

import type { DashboardFormValues } from "../editor/dashboard-form-values";
import { WidgetActions } from "./widget-actions";
import { WidgetEmptyState } from "./widget-empty-state";

interface RichTextWidgetEditorProps {
  widget: RichTextWidget;
  widgetIndex: number;
  isSelected: boolean;
  onRemove: () => void;
}

/**
 * Editor variant: select-to-edit. When the widget is selected the Quill
 * editor is mounted (auto-focused); otherwise we show the rendered HTML
 * (or a "Click to write…" hint when empty). This keeps the dashboard
 * looking like the read-only output by default and only reveals editor
 * chrome on intent.
 */
export function RichTextWidgetEditor({
  widget,
  widgetIndex,
  isSelected,
  onRemove,
}: RichTextWidgetEditorProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();
  const html = widget.config.html ?? "";
  const isEmpty = html.trim() === "" || html === "<p><br></p>";

  return (
    <>
      <WidgetActions ariaLabel={t("editor.inspector.title")}>
        <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 size-4" />
          {t("editor.inspector.delete")}
        </DropdownMenuItem>
      </WidgetActions>

      {isSelected ? (
        // The widget header already reserves space for editor chrome —
        // the body just flexes to fill what's left of the card.
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
      ) : isEmpty ? (
        <WidgetEmptyState
          icon={Pencil}
          title={t("editor.richTextConfig.emptyHint", "Click to add text")}
        />
      ) : (
        <div className="h-full overflow-auto p-4">
          <RichTextRenderer content={html} />
        </div>
      )}
    </>
  );
}
