"use client";

import type { StandardField } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

import { FilledFieldRow } from "./filled-field-row";
import { MissingFieldRow } from "./missing-field-row";

interface StandardFieldSectionProps {
  experimentId: string;
  section: string;
  fields: StandardField[];
}

/** One section of a standard, such as Study in MIAPPE, with each of its fields. */
export function StandardFieldSection({ experimentId, section, fields }: StandardFieldSectionProps) {
  const { t } = useTranslation("standards");

  const renderField = (field: StandardField) =>
    field.status === "filled" ? (
      <FilledFieldRow key={field.field} field={field} />
    ) : (
      <MissingFieldRow key={field.field} experimentId={experimentId} field={field} />
    );

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{t(`section.${section}`)}</h3>
      <ul className="divide-y rounded-md border">{fields.map(renderField)}</ul>
    </section>
  );
}
