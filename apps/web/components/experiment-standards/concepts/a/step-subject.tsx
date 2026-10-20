"use client";

import { useExperimentColumnDictionary } from "@/hooks/experiment/useExperimentColumnDictionary/useExperimentColumnDictionary";

import type { ColumnDictionary } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";

import type { ReadinessAction } from "../readiness-steps";

/** The columns a column step acts on, by name. Other steps act on no column. */
function stepColumns(action: ReadinessAction, dictionary: ColumnDictionary): string[] {
  const columns = dictionary.groups.flatMap((group) => group.columns);

  if (action === "describe-columns") {
    return columns.filter((column) => column.description === null).map((column) => column.name);
  }
  if (action === "add-terms") {
    return columns
      .filter((column) => column.description !== null && column.description.traitTerm === null)
      .map((column) => column.name);
  }
  return [];
}

interface StepSubjectProps {
  experimentId: string;
  action: ReadinessAction;
}

/** What a step acts on: the columns by name once the dictionary answers, otherwise a short line. */
export function StepSubject({ experimentId, action }: StepSubjectProps) {
  const { t, i18n } = useTranslation("readinessConceptA");
  const { data: dictionary } = useExperimentColumnDictionary(experimentId);

  const columns = dictionary ? stepColumns(action, dictionary) : [];
  const hasColumns = columns.length > 0;

  if (hasColumns) {
    const names = new Intl.ListFormat(i18n.language, { type: "unit", style: "short" }).format(
      columns,
    );
    return (
      <p className="text-muted-foreground truncate font-mono text-xs" title={names}>
        {names}
      </p>
    );
  }

  return <p className="text-muted-foreground text-sm">{t(`subject.${action}`)}</p>;
}
