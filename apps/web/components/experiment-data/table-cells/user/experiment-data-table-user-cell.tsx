"use client";

import { ContributorIdentity } from "~/components/contributor/contributor-identity";

interface ExperimentDataTableUserCellProps {
  data: string;
  columnName: string;
}

/**
 * Thin wrapper preserved for the existing call sites (experiment data
 * table, dashboard table widget). Rendering lives in `ContributorIdentity`
 * so the same look applies in filter dropdowns, filter chips, and any
 * future CONTRIBUTOR surface.
 */
export function ExperimentDataTableUserCell({
  data,
  columnName: _columnName,
}: ExperimentDataTableUserCellProps) {
  return <ContributorIdentity data={data} />;
}
