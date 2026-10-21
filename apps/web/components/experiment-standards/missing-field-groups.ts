import type {
  MissingStandardField,
  StandardField,
  StepReason,
  StepReasonCode,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";

export interface MissingFieldGroup {
  /** The reason the fields share, which is also the step that fills them. */
  reason: StepReason;
  fields: MissingStandardField[];
}

// Steps other people finish, which only inform, follow the ones the researcher can do.
const INFORMING: readonly StepReasonCode[] = ["members-without-orcid", "plots-left-skipped"];

/**
 * Gathers a standard's missing fields under the step that fills them, in the order the mapping lists
 * them, with the group named by `first` leading and the informing ones last.
 */
export function groupMissingFields(
  fields: StandardField[],
  first?: StepReasonCode,
): MissingFieldGroup[] {
  const groups = new Map<StepReasonCode, MissingFieldGroup>();

  for (const field of fields) {
    if (field.status === "missing") {
      const group = groups.get(field.reason.code) ?? { reason: field.reason, fields: [] };
      group.fields.push(field);
      groups.set(field.reason.code, group);
    }
  }

  const all = [...groups.values()];
  const isInforming = (group: MissingFieldGroup) => INFORMING.includes(group.reason.code);
  const ordered = [...all.filter((group) => !isInforming(group)), ...all.filter(isInforming)];
  const isFirst = (group: MissingFieldGroup) => group.reason.code === first;

  return [...ordered.filter(isFirst), ...ordered.filter((group) => !isFirst(group))];
}
