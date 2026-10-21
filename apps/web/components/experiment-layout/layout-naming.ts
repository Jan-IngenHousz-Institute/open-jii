import type { LayoutNaming } from "@repo/api/domains/experiment/layout/experiment-layout.schema";

import { rowLetter } from "./row-letter";

/** Names generated plots by their row and column, in the scheme a researcher chose. */
export class LayoutNamingScheme {
  constructor(
    private readonly naming: LayoutNaming,
    private readonly columns: number,
    private readonly firstNumber: number,
  ) {}

  identifier(row: number, column: number): string {
    if (this.naming === "runningNumber") {
      return String(this.firstNumber + (row - 1) * this.columns + column - 1);
    }
    if (this.naming === "rowColumn") {
      return `${row}-${column}`;
    }
    return `${rowLetter(row)}${column}`;
  }

  /** The first and last names of a field of this size, for "named A1 to F8". */
  range(rows: number): { first: string; last: string } {
    return { first: this.identifier(1, 1), last: this.identifier(rows, this.columns) };
  }
}
