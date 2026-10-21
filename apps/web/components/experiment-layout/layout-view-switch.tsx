"use client";

import { useTranslation } from "@repo/i18n";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

import type { LayoutView } from "./layout-view";
import { isLayoutView, LAYOUT_VIEWS } from "./layout-view";

interface LayoutViewSwitchProps {
  view: LayoutView;
  onViewChange: (view: LayoutView) => void;
}

const VIEW_LABELS: Record<LayoutView, string> = {
  plots: "layout.views.plots",
  "walking-order": "layout.views.walkingOrder",
  "field-days": "layout.views.fieldDays",
};

export function LayoutViewSwitch({ view, onViewChange }: LayoutViewSwitchProps) {
  const { t } = useTranslation("experiments");

  const handleChange = (value: string) => {
    if (isLayoutView(value)) {
      onViewChange(value);
    }
  };

  const renderTrigger = (candidate: LayoutView) => (
    <TabsTrigger key={candidate} value={candidate} className="px-3">
      {t(VIEW_LABELS[candidate])}
    </TabsTrigger>
  );

  return (
    <Tabs value={view} onValueChange={handleChange}>
      <TabsList aria-label={t("layout.views.label")} className="h-10">
        {LAYOUT_VIEWS.map(renderTrigger)}
      </TabsList>
    </Tabs>
  );
}
