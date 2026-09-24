import { useState } from "react";

const NONE: ReadonlySet<string> = new Set();

interface Seen {
  rows: readonly { id?: unknown }[] | undefined;
  viewKey: string;
  landed: ReadonlySet<string>;
}

/**
 * Ids of the rows a refetch added to the same view (page, sort, filters),
 * named by `viewKey`. A first load or a change of view lands nothing, so only
 * rows that arrived while the table was open count.
 */
export function useLandedRowIds(
  rows: readonly { id?: unknown }[] | undefined,
  viewKey: string,
): ReadonlySet<string> {
  const [seen, setSeen] = useState<Seen>({ rows, viewKey, landed: NONE });

  if (seen.rows !== rows || seen.viewKey !== viewKey) {
    const isRefetch = seen.viewKey === viewKey && seen.rows !== undefined && rows !== undefined;
    const before = new Set(seen.rows?.map((row) => String(row.id)));
    const landed = isRefetch
      ? new Set(rows.map((row) => String(row.id)).filter((id) => !before.has(id)))
      : NONE;
    setSeen({ rows, viewKey, landed });
    return landed;
  }

  return seen.landed;
}
