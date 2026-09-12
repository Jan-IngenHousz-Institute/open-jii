import { DocsHelpLink } from "@/components/docs-help-link";
import { ExperimentOverviewCard } from "@/components/experiment-overview-card";
import { ResourceCardGrid } from "@/components/shared/resource-card";
import { useLocale } from "@/hooks/useLocale";
import React from "react";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

export function ExperimentOverviewCards({
  experiments,
  archived = false,
  showGetStartedHelp = false,
}: {
  experiments: ExperimentListItem[] | undefined;
  archived?: boolean;
  showGetStartedHelp?: boolean;
}) {
  const { t } = useTranslation("experiments");
  const locale = useLocale();

  const segment = archived ? "experiments-archive" : "experiments";

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
        />
      ))}
    </ResourceCardGrid>
  );
}
