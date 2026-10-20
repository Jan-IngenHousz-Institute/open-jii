import type {
  FieldSource,
  StandardFields,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";

const FINISHED_WORK = ["study-details", "license", "funding", "layout"] as const;

export type FinishedWork = (typeof FINISHED_WORK)[number];

/** The groundwork already in place, in the order the done line names it. */
export function finishedWork(
  readiness: StandardReadiness[],
  miappe: StandardFields,
): FinishedWork[] {
  const isFilledFrom = (source: FieldSource) =>
    miappe.fields.some((field) => field.status === "filled" && field.source === source);

  const isLicensed = miappe.fields.some(
    (field) => field.status === "filled" && field.field === "license",
  );
  // The floor's funding-missing reason also carries the dataset count, so any other reason means
  // funding is in.
  const isFunded = readiness.some(
    (row) => row.standard === "openaire-floor" && row.reason.code !== "funding-missing",
  );
  const isLayoutOpen = miappe.fields.some(
    (field) => field.status === "missing" && field.fix === "open-layout",
  );

  const isDone: Record<FinishedWork, boolean> = {
    "study-details": isFilledFrom("study-details"),
    license: isLicensed,
    funding: isFunded,
    layout: isFilledFrom("layout") && !isLayoutOpen,
  };

  return FINISHED_WORK.filter((work) => isDone[work]);
}
