"use client";

import { PublicationItem } from "@/components/datasets/publications/publication-item";
import { useExperimentPublications } from "@/hooks/dataset/useExperimentPublications/useExperimentPublications";

import type { RelatedPublication } from "@repo/api/domains/dataset/dataset.schema";
import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

interface ExperimentPublicationsSectionProps {
  experimentId: string;
  experiment: Experiment;
  hasAccess: boolean;
}

/** Papers the experiment underlies, which each dataset copies into its record when it freezes. */
export function ExperimentPublicationsSection({
  experimentId,
  hasAccess,
}: ExperimentPublicationsSectionProps) {
  const { t } = useTranslation("datasets");
  const { data: publications, isLoading } = useExperimentPublications(experimentId);
  const isEmpty = publications?.length === 0;
  const hasPublications = publications !== undefined && publications.length > 0;

  const renderPublication = (publication: RelatedPublication) => (
    <PublicationItem key={publication.id} publication={publication} />
  );

  return (
    <div className="space-y-1" data-testid="experiment-publications">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t("publications.title")}</h4>
        {hasAccess ? (
          <Button variant="link" className="h-auto p-0">
            {t("publications.edit")}
          </Button>
        ) : null}
      </div>

      {isLoading ? <Skeleton className="h-12 w-full" /> : null}
      {isEmpty ? (
        <p className="text-muted-foreground text-sm italic">{t("publications.empty")}</p>
      ) : null}
      {hasPublications ? (
        <ul className="space-y-3">{publications.map(renderPublication)}</ul>
      ) : null}
    </div>
  );
}
