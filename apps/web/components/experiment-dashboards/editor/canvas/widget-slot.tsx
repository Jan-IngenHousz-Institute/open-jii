"use client";

import { memo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import { WidgetCard } from "../../widgets/shell/widget-card";
import { WidgetEditor } from "../../widgets/widget-editor";

export interface WidgetSlotProps {
  widgetId: string;
  widgetIndex: number;
  experimentId: string;
  isSelected: boolean;
  onSelect: (widgetId: string) => void;
}

export const WidgetSlot = memo(function WidgetSlot({
  widgetId,
  widgetIndex,
  experimentId,
  isSelected,
  onSelect,
}: WidgetSlotProps) {
  const { control } = useFormContext<DashboardFormValues>();
  const widget = useWatch({ control, name: `widgets.${widgetIndex}` });
  // Stale index after delete+select in same tick; wait for realign.
  if (widget.id !== widgetId) return null;

  return (
    <WidgetCard isSelected={isSelected} onSelect={() => onSelect(widgetId)}>
      <WidgetEditor
        widget={widget}
        experimentId={experimentId}
        widgetIndex={widgetIndex}
        isSelected={isSelected}
      />
    </WidgetCard>
  );
});
