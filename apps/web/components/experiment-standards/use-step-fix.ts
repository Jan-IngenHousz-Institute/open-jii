import { useLocale } from "~/hooks/useLocale";

import type {
  StepReason,
  StepReasonCode,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

export interface StepFix {
  label: string;
  href: string;
}

type FixableCode = Exclude<StepReasonCode, "plots-left-skipped">;

/**
 * The one action that fixes a step, or null when nobody viewing can: skipped plots only inform, and
 * only the members named can connect their own ORCID iD.
 */
export function useStepFix(experimentId: string): (reason: StepReason) => StepFix | null {
  const { t } = useTranslation("standards");
  const locale = useLocale();

  // Scaffold: each fix opens in place as a sheet or dialog in the product, so these pages stand in.
  const experimentPath = `/${locale}/platform/experiments/${experimentId}`;
  const plotsView = `${experimentPath}/layout?view=plots`;
  const fixPaths: Record<FixableCode, string> = {
    "no-location": experimentPath,
    "no-layout": plotsView,
    "columns-not-described": `${experimentPath}/data`,
    "columns-without-term": `${experimentPath}/data`,
    "unit-without-greenhouse-term": plotsView,
    "plots-without-treatment": plotsView,
    "plots-measured-twice": `${experimentPath}/layout?view=field-days`,
    "members-without-orcid": `/${locale}/platform/account`,
  };

  return (reason) => {
    if (reason.code === "plots-left-skipped") {
      return null;
    }
    if (reason.code === "members-without-orcid" && !reason.includesViewer) {
      return null;
    }

    return { label: t(`fix.${reason.code}`), href: fixPaths[reason.code] };
  };
}
