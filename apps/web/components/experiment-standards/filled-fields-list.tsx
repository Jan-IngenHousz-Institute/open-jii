"use client";

import { ChevronRight } from "lucide-react";

import type { FilledStandardField } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";

import { FilledFieldRow } from "./filled-field-row";

interface FilledFieldsListProps {
  fields: FilledStandardField[];
}

/** The fields already filled, collapsed under their count so the gaps lead. */
export function FilledFieldsList({ fields }: FilledFieldsListProps) {
  const { t } = useTranslation("standards");

  const renderField = (field: FilledStandardField) => (
    <FilledFieldRow key={field.field} field={field} />
  );

  return (
    <Collapsible className="space-y-2">
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm font-medium">
        <ChevronRight
          aria-hidden
          className="size-4 transition-transform group-data-[state=open]:rotate-90"
        />
        {t("panel.filled", { count: fields.length })}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul className="divide-y rounded-md border">{fields.map(renderField)}</ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
