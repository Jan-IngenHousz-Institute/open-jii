"use client";

import Link from "next/link";

import type { MissingStandardField } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { Button } from "@repo/ui/components/button";

import type { MissingFieldGroup as MissingFieldGroupData } from "./missing-field-groups";
import { MissingFieldRow } from "./missing-field-row";
import { useStepCopy } from "./use-step-copy";
import { useStepFix } from "./use-step-fix";

interface MissingFieldGroupProps {
  experimentId: string;
  group: MissingFieldGroupData;
  /** False for viewers, for an archived experiment, and inside the export dialog. */
  canFix: boolean;
}

/** The fields one step would fill, under that step's words and its one action. */
export function MissingFieldGroup({ experimentId, group, canFix }: MissingFieldGroupProps) {
  const copy = useStepCopy()(group.reason);
  const fix = useStepFix(experimentId)(group.reason);

  const isFixShown = canFix && fix !== null;

  const renderField = (field: MissingStandardField) => (
    <MissingFieldRow key={field.field} field={field} />
  );

  return (
    <section className="rounded-md border">
      <div className="flex items-start gap-3 border-b px-3 py-2.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h4 className="text-sm font-medium">{copy.title}</h4>
          {copy.subjects === null ? null : (
            <p className="text-muted-foreground text-xs">{copy.subjects}</p>
          )}
          {copy.note === null ? null : <p className="text-muted-foreground text-xs">{copy.note}</p>}
        </div>

        {isFixShown ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={fix.href}>{fix.label}</Link>
          </Button>
        ) : null}
      </div>

      <ul className="divide-y">{group.fields.map(renderField)}</ul>
    </section>
  );
}
