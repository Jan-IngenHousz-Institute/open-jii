import { DocsHelpLink } from "@/components/docs-help-link";
import { ResourceCard, ResourceCardGrid } from "@/components/shared/resource-card";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import React from "react";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

export function ExperimentOverviewCards({
  experiments,
  archived = false,
  showGetStartedHelp = false,
}: {
  experiments: Experiment[] | undefined;
  archived?: boolean;
  showGetStartedHelp?: boolean;
}) {
  const { t } = useTranslation("experiments");

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
        <ResourceCard
          key={experiment.id}
          href={
            archived
              ? `/platform/experiments-archive/${experiment.id}`
              : `/platform/experiments/${experiment.id}`
          }
          title={experiment.name}
          // Only when private: "public" is the unremarkable default.
          badges={<VisibilityBadge visibility={experiment.visibility} privateOnly />}
          footer={`${t("lastUpdate")}: ${new Date(experiment.updatedAt).toLocaleDateString()}`}
        >
          <RichTextRenderer content={experiment.description ?? " "} truncate maxLines={2} />
        </ResourceCard>
      ))}
    </ResourceCardGrid>
  );
}
