import type { Fixture } from "./fixture.js";

/** The example field from `.claude/drafts/example-field.md`: six by eight, gaps at B4 and E7. */
export const FIELD_ROWS = 6;
export const FIELD_COLUMNS = 8;
export const FIELD_GAPS: ReadonlySet<string> = new Set(["B4", "E7"]);
export const TREATMENTS = ["Control", "Drought", "Severe drought"] as const;

export interface ExamplePlot {
  id: string;
  parentId: null;
  identifier: string;
  row: number;
  column: number;
  active: boolean;
  block: string;
  genotype: string;
  treatment: string;
}

export function rowLetter(row: number): string {
  return String.fromCharCode(64 + row);
}

export function examplePlotId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

/** Every active plot of the example field, in row then column order, with its attributes. */
export function examplePlots(): ExamplePlot[] {
  const plots: ExamplePlot[] = [];
  for (let row = 1; row <= FIELD_ROWS; row++) {
    for (let column = 1; column <= FIELD_COLUMNS; column++) {
      const identifier = `${rowLetter(row)}${column}`;
      if (FIELD_GAPS.has(identifier)) {
        continue;
      }
      plots.push({
        id: examplePlotId(plots.length + 1),
        parentId: null,
        identifier,
        row,
        column,
        active: true,
        block: String(Math.ceil(row / 2)),
        genotype: column <= 4 ? "Line A" : "Line B",
        treatment: TREATMENTS[(row + column) % 3],
      });
    }
  }
  return plots;
}

export function exampleFieldLayout() {
  const units = examplePlots().map(({ id, parentId, identifier, row, column, active }) => ({
    id,
    parentId,
    identifier,
    row,
    column,
    active,
  }));
  return {
    levelName: "Plot",
    rows: FIELD_ROWS,
    columns: FIELD_COLUMNS,
    naming: "rowLetter",
    firstNumber: 1,
    readingCount: 0,
    units,
  };
}

/** Answers the layout route with the example field, which no table holds yet. */
export const exampleLayoutFixture: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => /^\/api\/v1\/experiments\/[^/]+\/layout$/.test(url.pathname),
      (route) => route.fulfill({ status: 200, json: exampleFieldLayout() }),
    );
  },
};
