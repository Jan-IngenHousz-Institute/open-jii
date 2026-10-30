export const MEASURED_CONTRIBUTOR_ATTRIBUTION_PORT = Symbol(
  "MEASURED_CONTRIBUTOR_ATTRIBUTION_PORT",
);

export interface MeasuredContributorAttributionPort {
  enrichRows(
    rows: Record<string, string | null>[],
    columns: { name: string; type_text: string }[],
  ): Promise<Record<string, string | null>[]>;
}
