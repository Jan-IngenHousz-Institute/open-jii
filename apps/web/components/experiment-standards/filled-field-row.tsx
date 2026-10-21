"use client";

import { CheckCircle2 } from "lucide-react";

import type { FilledStandardField } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

interface FilledFieldRowProps {
  field: FilledStandardField;
}

/** A field the experiment fills: its value in full and where the value comes from. */
export function FilledFieldRow({ field }: FilledFieldRowProps) {
  const { t } = useTranslation("standards");

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <CheckCircle2
        aria-label={t("panel.from", { source: t(`source.${field.source}`) })}
        className="text-status-active-foreground mt-0.5 size-4 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{t(`field.${field.field}`)}</p>
        <p className="wrap-break-word text-sm">{field.value}</p>
      </div>

      <span className="text-muted-foreground shrink-0 pt-0.5 text-xs">
        {t("panel.from", { source: t(`source.${field.source}`) })}
      </span>
    </li>
  );
}
