import type { RelationType } from "@repo/api/domains/experiment/study/experiment-study.schema";
import { useTranslation } from "@repo/i18n";

/** How a related work relates to the study, in words, such as Described by. */
export function useRelationLabel(): (relation: RelationType) => string {
  const { t } = useTranslation("studyMetadata");

  const labels: Record<RelationType, string> = {
    IsDescribedBy: t("relatedWork.relationIsDescribedBy"),
    IsSupplementTo: t("relatedWork.relationIsSupplementTo"),
    References: t("relatedWork.relationReferences"),
    IsDerivedFrom: t("relatedWork.relationIsDerivedFrom"),
    IsCitedBy: t("relatedWork.relationIsCitedBy"),
  };

  return (relation) => labels[relation];
}
