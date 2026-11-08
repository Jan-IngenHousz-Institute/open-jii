"use client";

import { memo } from "react";
import { HistoryLegend } from "~/components/history/history-legend";
import { SectionTitle } from "~/components/shared/section-title";

import { useTranslation } from "@repo/i18n/client";
import type { Incident, StatusComponent } from "@repo/monitoring/status-document";
import { Card } from "@repo/ui/components/card";

import { ComponentRow } from "./component-row";

interface ComponentsSectionProps {
  components: StatusComponent[];
  incidents: Incident[];
  today: string;
  isStale: boolean;
}

export const ComponentsSection = memo(function ComponentsSection({
  components,
  incidents,
  today,
  isStale,
}: ComponentsSectionProps) {
  const { t } = useTranslation("status");

  function renderRow(component: StatusComponent) {
    return (
      <ComponentRow
        key={component.id}
        component={component}
        incidents={incidents}
        today={today}
        isStale={isStale}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionTitle>{t("components.title")}</SectionTitle>
        <HistoryLegend />
      </div>

      <Card padding="none" className="gap-0">
        {components.map(renderRow)}
      </Card>
    </>
  );
});
