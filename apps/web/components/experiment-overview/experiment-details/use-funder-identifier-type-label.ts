import type { FunderIdentifierType } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

/** The registry a funder identifier comes from, in words. */
export function useFunderIdentifierTypeLabel(): (type: FunderIdentifierType) => string {
  const { t } = useTranslation("studyMetadata");

  const labels: Record<FunderIdentifierType, string> = {
    ROR: t("funding.identifierTypeRor"),
    "Crossref Funder ID": t("funding.identifierTypeCrossref"),
  };

  return (type) => labels[type];
}
