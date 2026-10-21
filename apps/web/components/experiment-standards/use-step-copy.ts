import { formatList } from "@/components/calibrations/format-list";
import { useLocale } from "~/hooks/useLocale";

import type { StepReason } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

export interface StepCopy {
  title: string;
  /** The columns or plots the step acts on, when the title only counts them. */
  subjects: string | null;
  /** Why the step only informs. */
  note: string | null;
}

/** The words for one step, the same on the Datasets tab, in Check and in the field panel. */
export function useStepCopy(): (reason: StepReason) => StepCopy {
  const { t } = useTranslation("standards");
  const locale = useLocale();

  return (reason) => {
    if (reason.code === "no-location" || reason.code === "no-layout") {
      return { title: t(`step.${reason.code}`), subjects: null, note: null };
    }

    const count = reason.subjects.length;
    const names = formatList(locale, reason.subjects);

    if (reason.code === "unit-without-greenhouse-term") {
      return { title: t(`step.${reason.code}`), subjects: names, note: null };
    }
    if (reason.code === "members-without-orcid") {
      return {
        title: t("step.members-without-orcid", { count, names }),
        subjects: null,
        note: t("stepNote.members-without-orcid"),
      };
    }
    if (reason.code === "plots-left-skipped") {
      return {
        title: t("step.plots-left-skipped", { count }),
        subjects: names,
        note: t("stepNote.plots-left-skipped"),
      };
    }

    return { title: t(`step.${reason.code}`, { count }), subjects: names, note: null };
  };
}
