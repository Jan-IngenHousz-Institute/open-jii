"use client";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

interface StandardNameProps {
  standard: StandardId;
  /** Said after the standard's own name, such as how far the experiment is. */
  detail?: string;
}

/** A standard by what it provides, with its own name beneath as small text. */
export function StandardName({ standard, detail }: StandardNameProps) {
  const { t } = useTranslation("standards");
  const name = t(`standard.${standard}.name`);

  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-sm font-medium">{t(`standard.${standard}.title`)}</p>
      <p className="text-muted-foreground text-xs">
        {detail === undefined ? name : t("named", { name, detail })}
      </p>
    </div>
  );
}
