"use client";

import { BarChart3, Table2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";

export type PanelView = "chart" | "table";

interface ChartTableToggleProps {
  view: PanelView;
  onViewChange: (view: PanelView) => void;
}

/** Chart/table view switch: the table view doubles as the accessible fallback. */
export function ChartTableToggle({ view, onViewChange }: ChartTableToggleProps) {
  const { t } = useTranslation("iot");

  const handleChange = (value: string) => {
    if (value === "chart" || value === "table") {
      onViewChange(value);
    }
  };

  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={view}
      onValueChange={handleChange}
      className="bg-muted rounded-md p-0.5"
    >
      <ToggleGroupItem value="chart" aria-label={t("iot.devices.monitoring.viewChart")}>
        <BarChart3 className="h-3.5 w-3.5" />
      </ToggleGroupItem>
      <ToggleGroupItem value="table" aria-label={t("iot.devices.monitoring.viewTable")}>
        <Table2 className="h-3.5 w-3.5" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
