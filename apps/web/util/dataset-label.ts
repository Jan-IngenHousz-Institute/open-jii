import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";

/**
 * A dataset's bare name. Macro tables come back wrapped as
 * `"Processed Data (chlorophyll)"`, where the wrapper repeats whatever the
 * surrounding UI already says, so only the parenthesised name survives. The
 * other table types are named plainly and pass through.
 */
export function datasetLabel(table: ExperimentTableMetadata): string {
  if (table.tableType !== "macro") {
    return table.displayName;
  }

  const inner = /\(([^()]*)\)\s*$/.exec(table.displayName)?.[1]?.trim();

  return inner === undefined || inner === "" ? table.displayName : inner;
}
