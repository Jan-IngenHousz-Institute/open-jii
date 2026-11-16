"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import type { FilledStandardField } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface FilledFieldRowProps {
  field: FilledStandardField;
  /** Where a derived value's source is set, since the value changes only there. */
  sourceHref: string | null;
}

/** A field the experiment fills: its value in full and where the value comes from. */
export function FilledFieldRow({ field, sourceHref }: FilledFieldRowProps) {
  const { t } = useTranslation("standards");

  const from = t("panel.from", { source: t(`source.${field.source}`) });

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <CheckCircle2
        aria-label={from}
        className="text-status-active-foreground mt-0.5 size-4 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{t(`field.${field.field}`)}</p>
        <p className="wrap-break-word text-sm">{field.value}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs">
        {field.derived ? (
          <Badge variant="secondary" className="font-normal">
            {t("panel.derived")}
          </Badge>
        ) : null}
        {sourceHref === null ? (
          <span className="text-muted-foreground">{from}</span>
        ) : (
          <Link href={sourceHref} className="text-primary hover:underline">
            {from}
          </Link>
        )}
      </div>
    </li>
  );
}
