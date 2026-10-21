"use client";

import { ShieldCheck } from "lucide-react";
import { useLocale } from "~/hooks/useLocale";

import type { ValidatorVerdict } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

interface ValidatorVerdictLineProps {
  verdict: ValidatorVerdict | null;
}

/** The official validator's verdict on the latest package, which the MIAPPE export records. */
export function ValidatorVerdictLine({ verdict }: ValidatorVerdictLineProps) {
  const { t } = useTranslation("standards");
  const locale = useLocale();

  const text = () => {
    if (verdict === null) {
      return t("panel.validatorNotRun");
    }
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
      new Date(verdict.checkedAt),
    );
    return verdict.passed
      ? t("panel.validatorPassed", { date })
      : t("panel.validatorFailed", { date });
  };

  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm">
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
      {text()}
    </p>
  );
}
