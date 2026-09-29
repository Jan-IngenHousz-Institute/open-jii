import { DocsHelpLink } from "@/components/docs-help-link";
import { ExperimentOverviewCard, hasBadges } from "@/components/experiment-overview-card";
import { ResourceCardGrid } from "@/components/shared/resource-card";
import { useLocale } from "@/hooks/useLocale";
import React from "react";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

/**
 * Renders experiment cards with aligned badge rows and links to active or archived experiment details.
 * Handles loading and empty states and optionally labels each card's update date.
 */
export function ExperimentOverviewCards({
  experiments,
  archived = false,
  showGetStartedHelp = false,
  showUpdatedLabel = false,
}: {
  experiments: ExperimentListItem[] | undefined;
  archived?: boolean;
  showGetStartedHelp?: boolean;
  /** Prefix each card's date with "Updated", for places without a column header to say so. */
  showUpdatedLabel?: boolean;
}) {
  const { t } = useTranslation("experiments");
  const locale = useLocale();

  const segment = archived ? "experiments-archive" : "experiments";
  const reserveBadgeRow = experiments?.some(hasBadges) ?? false;

  return (
    <ResourceCardGrid
      isLoading={!experiments}
      isEmpty={experiments?.length === 0}
      emptyMessage={t("experiments.noExperiments")}
      emptyExtra={
        showGetStartedHelp ? <DocsHelpLink path="/guide/get-started/quick-start" /> : null
      }
    >
      {experiments?.map((experiment) => (
        <ExperimentOverviewCard
          key={experiment.id}
          experiment={experiment}
          href={`/${locale}/platform/${segment}/${experiment.id}`}
          locale={locale}
          reserveBadgeRow={reserveBadgeRow}
          showUpdatedLabel={showUpdatedLabel}
        />
      ))}
    </ResourceCardGrid>
  );
}
