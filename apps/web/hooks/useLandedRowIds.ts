import { useState } from "react";

const NONE: ReadonlySet<string> = new Set();

interface Row {
  id?: unknown;
  processed_timestamp?: unknown;
}

interface Seen {
  rows: readonly Row[] | undefined;
  viewKey: string;
  latestRowAt: string | null | undefined;
  landed: ReadonlySet<string>;
}

function isProcessedAfter(row: Row, latestRowAt: string): boolean {
  return Date.parse(String(row.processed_timestamp)) > Date.parse(latestRowAt);
}

/**
 * Ids of the rows a refetch brought into the same view (page, sort, filters),
 * named by `viewKey`, that the pipeline processed after the table's newest row
 * as of the previous read. A row that only moved into the view, such as one an
 * arrival pushed onto the next page, was there before and lands nothing. So do
 * a first load, a change of view and a table with no newest-row time. `rows`
 * must belong to that view; pass `undefined` while another view's rows stand in.
 */
export function useLandedRowIds(
  rows: readonly Row[] | undefined,
  viewKey: string,
  latestRowAt: string | null | undefined,
): ReadonlySet<string> {
  const [seen, setSeen] = useState<Seen>({ rows, viewKey, latestRowAt, landed: NONE });

  if (seen.rows !== rows || seen.viewKey !== viewKey) {
    const baseline = seen.latestRowAt;
    const isRefetch = seen.viewKey === viewKey && seen.rows !== undefined && rows !== undefined;
    const before = new Set(seen.rows?.map((row) => String(row.id)));
    const landed =
      isRefetch && baseline
        ? new Set(
            rows
              .filter((row) => !before.has(String(row.id)) && isProcessedAfter(row, baseline))
              .map((row) => String(row.id)),
          )
        : NONE;
    setSeen({ rows, viewKey, latestRowAt, landed });
    return landed;
  }

  return seen.landed;
}
