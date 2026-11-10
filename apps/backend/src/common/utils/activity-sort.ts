import { sql } from "@repo/database";

/** `sql.param` binds each array once; direct array interpolation expands into a row expression. */
export function activityTotalsSource(totals: ReadonlyMap<string, number>) {
  return sql`unnest(${sql.param([...totals.keys()])}::uuid[], ${sql.param([...totals.values()])}::int[]) as activity_totals(id, total)`;
}

export const activityTotalSql = sql<number | null>`activity_totals.total`;

export function sortsByActivity(sort?: readonly { field: string }[]): boolean {
  return sort?.some(({ field }) => field === "activity") ?? false;
}

export function withoutActivity<T extends { field: string }>(sort?: T[]): T[] | undefined {
  const remaining = sort?.filter(({ field }) => field !== "activity");
  return remaining?.length ? remaining : undefined;
}
