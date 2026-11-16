import type {
  DatasetScopeChoice,
  ScopeDay,
  ScopeTable,
} from "@repo/api/domains/dataset/dataset.schema";

/** The readings a choice holds before Curate. Dates are calendar days, so they compare as text. */
export function countScopeChoice(tables: ScopeTable[], choice: DatasetScopeChoice): number {
  const isIncluded = (table: ScopeTable) => choice.tables.some(({ name }) => name === table.name);
  const isInRange = (day: ScopeDay) => day.date >= choice.from && day.date <= choice.to;
  const countTable = (table: ScopeTable) =>
    table.days === null
      ? table.readingCount
      : table.days.filter(isInRange).reduce((sum, day) => sum + day.readingCount, 0);

  return tables.filter(isIncluded).reduce((sum, table) => sum + countTable(table), 0);
}
