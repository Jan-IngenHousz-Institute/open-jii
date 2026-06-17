"use client";

import { Type } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";

import { StripPopoverControl } from "../strip-popover-control";

export interface WidgetDisplayPopoverProps {
  widgetId: string;
  showTitle: boolean;
  showDescription: boolean;
  title: string;
  description: string;
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  onShowTitleChange: (value: boolean) => void;
  onShowDescriptionChange: (value: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

/** Shared title + description toggle/override popover used by every widget strip. */
export function WidgetDisplayPopover({
  widgetId,
  showTitle,
  showDescription,
  title,
  description,
  titlePlaceholder,
  descriptionPlaceholder,
  onShowTitleChange,
  onShowDescriptionChange,
  onTitleChange,
  onDescriptionChange,
}: WidgetDisplayPopoverProps) {
  const { t } = useTranslation("experimentDashboards");
  const summaryParts = [
    showTitle ? t("editor.widgetHeader.title") : null,
    showDescription ? t("editor.widgetHeader.description") : null,
  ].filter(Boolean);

  return (
    <StripPopoverControl
      label={t("editor.inspector.display")}
      summary={summaryParts.join(", ") || undefined}
      icon={Type}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`show-title-${widgetId}`} className="text-xs">
            {t("editor.widgetHeader.title")}
          </Label>
          <Switch
            id={`show-title-${widgetId}`}
            checked={showTitle}
            onCheckedChange={onShowTitleChange}
          />
        </div>
        {showTitle && (
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={titlePlaceholder}
            className="h-8 text-xs"
          />
        )}
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`show-desc-${widgetId}`} className="text-xs">
            {t("editor.widgetHeader.description")}
          </Label>
          <Switch
            id={`show-desc-${widgetId}`}
            checked={showDescription}
            onCheckedChange={onShowDescriptionChange}
          />
        </div>
        {showDescription && (
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={descriptionPlaceholder}
            rows={2}
            className="text-xs"
          />
        )}
      </div>
    </StripPopoverControl>
  );
}
