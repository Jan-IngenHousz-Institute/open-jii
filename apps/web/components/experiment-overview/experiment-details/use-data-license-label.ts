import type { DataLicense } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

/** The short name a license goes by outside its picker, such as CC BY 4.0. */
export function useDataLicenseLabel(): (license: DataLicense) => string {
  const { t } = useTranslation("experiments");

  const labels: Record<DataLicense, string> = {
    "CC0-1.0": t("studyDetails.licenseCc0Short"),
    "CC-BY-4.0": t("studyDetails.licenseCcByShort"),
  };

  return (license) => labels[license];
}
