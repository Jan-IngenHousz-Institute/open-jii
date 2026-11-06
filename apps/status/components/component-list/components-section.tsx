"use client";

import { memo } from "react";
import { Dominoes } from "~/components/extras/dominoes";
import { IntakeLeaf } from "~/components/extras/intake-leaf";
import { HistoryLegend } from "~/components/history/history-legend";
import { SectionTitle } from "~/components/shared/section-title";

import { useTranslation } from "@repo/i18n/client";
import type { Incident, StatusComponent } from "@repo/monitoring/status-document";
import { Card } from "@repo/ui/components/card";

import { ComponentRow } from "./component-row";

interface ComponentsSectionProps {
  components: StatusComponent[];
  incidents: Incident[];
  generatedAt: string;
  messagesPerMinute: number | undefined;
  hasExtras: boolean;
  isStale: boolean;
}

// The extras only play when nothing is wrong and the data is fresh.
export const ComponentsSection = memo(function ComponentsSection({
  components,
  incidents,
  generatedAt,
  messagesPerMinute,
  hasExtras,
  isStale,
}: ComponentsSectionProps) {
  const { t } = useTranslation("status");

  function renderRow(component: StatusComponent) {
    const hasLeaf = hasExtras && component.id === "data-intake";

    return (
      <ComponentRow
        key={component.id}
        component={component}
        incidents={incidents}
        generatedAt={generatedAt}
        isStale={isStale}
        adornment={hasLeaf ? <IntakeLeaf messagesPerMinute={messagesPerMinute} /> : undefined}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionTitle>{t("components.title")}</SectionTitle>
        <HistoryLegend />
      </div>

      <Dominoes isEnabled={hasExtras}>
        <Card padding="none" className="gap-0 overflow-x-clip">
          {components.map(renderRow)}
        </Card>
      </Dominoes>
    </>
  );
});
