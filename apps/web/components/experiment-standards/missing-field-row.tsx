"use client";

import { CircleDashed } from "lucide-react";

import type { MissingStandardField } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

interface MissingFieldRowProps {
  field: MissingStandardField;
}

/** A field the experiment cannot fill yet, under the step that fills it. */
export function MissingFieldRow({ field }: MissingFieldRowProps) {
  const { t } = useTranslation("standards");

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <CircleDashed
        aria-label={t("panel.notFilled")}
        className="text-status-stale-foreground size-4 shrink-0"
      />
      <p className="text-sm">{t(`field.${field.field}`)}</p>
    </li>
  );
}
