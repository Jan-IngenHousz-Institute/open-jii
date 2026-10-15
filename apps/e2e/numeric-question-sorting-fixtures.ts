import type { Page } from "@playwright/test";

import { mockLakehouse } from "./experiment-data-fixtures.js";

export const numericSortExperimentName = "[E2E] Numeric question sorting";
export const numericSortFilter = JSON.stringify([
  { column: "id", operator: "greater_than", value: 0 },
]);
export const numericSortColumns = [
  { name: "id", type_name: "BIGINT", type_text: "BIGINT" },
  { name: "value", type_name: "BIGINT", type_text: "BIGINT" },
  { name: "answer", type_name: "STRING", type_text: "STRING" },
  { name: "label", type_name: "STRING", type_text: "STRING" },
  { name: "sample", type_name: "STRING", type_text: "STRING" },
  {
    name: "sample_answer",
    type_name: "STRING",
    type_text: "STRING",
    renamedFrom: { name: "sample", source: "questions_data" },
  },
];
const answers = [
  "001",
  "1",
  ...Array.from({ length: 16 }, (_, i) => String(i + 2)),
  "100",
  "apple",
  "pear",
  "",
  " ",
  null,
];
const rows = answers.map((answer, i) => ({
  id: String(i + 1),
  value: String(i + 1),
  answer,
  label: `row-${String(i + 1).padStart(2, "0")}`,
  sample: `sample-${i + 1}`,
  sample_answer: answer,
}));
// These are explicit server orders for browser wiring checks. Spark proves the actual parser.
const numericAscending = Array.from({ length: 24 }, (_, i) => i + 1);
const numericDescending = [19, ...Array.from({ length: 18 }, (_, i) => 18 - i), 21, 20, 23, 22, 24];

export interface DataRequest {
  tableName: string;
  page: string;
  pageSize: string;
  orderBy: string;
  orderDirection: string;
  filters?: string;
}

export function dataRequest(
  page: number,
  orderBy: string,
  orderDirection: "ASC" | "DESC",
  pageSize = 10,
  filters?: string,
): DataRequest {
  return {
    tableName: "raw_data",
    page: String(page),
    pageSize: String(pageSize),
    orderBy,
    orderDirection,
    ...(filters ? { filters } : {}),
  };
}

export function fixtureRows(request: DataRequest) {
  const numeric = request.orderBy === "answer" || request.orderBy === "sample_answer";
  const ids = numeric
    ? request.orderDirection === "ASC"
      ? numericAscending
      : numericDescending
    : request.orderDirection === "ASC"
      ? numericAscending
      : [...numericAscending].reverse();
  const start = (Number(request.page) - 1) * Number(request.pageSize);
  return ids.slice(start, start + Number(request.pageSize)).map((id) => rows[id - 1]);
}

export interface RequestStep {
  request: DataRequest;
  waitForRelease?: Promise<void>;
}

/** Strict ordered route plan: no unexpected request can return a valid data page. */
export async function mockNumericQuestionSorting(
  page: Page,
  experimentId: string,
  steps: RequestStep[],
) {
  await mockLakehouse(page, experimentId, { withTable: true });
  const prefix = `/api/v1/experiments/${experimentId}`;
  const requests: Record<string, string>[] = [];
  const unexpected: Record<string, string>[] = [];
  await page.route(
    (url) => url.pathname === `${prefix}/tables`,
    (route) =>
      route.fulfill({
        json: [
          {
            identifier: "raw_data",
            tableType: "static",
            displayName: "Synthetic measurements",
            totalRows: rows.length,
            latestRowAt: "2026-10-01T12:00:00.000Z",
            schemaRevision: "numeric-fixture",
            defaultSortColumn: "id",
          },
        ],
      }),
  );
  await page.route(
    (url) => url.pathname === `${prefix}/data/columns`,
    (route) => route.fulfill({ json: { columns: numericSortColumns } }),
  );
  await page.route(
    (url) => url.pathname === `${prefix}/data`,
    async (route) => {
      const actual = Object.fromEntries(new URL(route.request().url()).searchParams);
      const expected = steps.at(requests.length);
      requests.push(actual);
      const keys = Object.keys(actual).sort();
      if (
        route.request().method() !== "GET" ||
        !expected ||
        JSON.stringify(keys.map((key) => [key, actual[key]])) !==
          JSON.stringify(Object.entries(expected.request).sort(([a], [b]) => a.localeCompare(b)))
      ) {
        unexpected.push(actual);
        return route.fulfill({
          status: 400,
          json: {
            message: "Unexpected numeric-sort fixture request",
            sentinel: "UNEXPECTED_REQUEST",
          },
        });
      }
      await expected.waitForRelease;
      return route.fulfill({
        json: [
          {
            name: "raw_data",
            catalog_name: "synthetic",
            schema_name: "synthetic",
            data: {
              columns: numericSortColumns,
              rows: fixtureRows(expected.request),
              totalRows: rows.length,
              truncated: false,
            },
            page: Number(actual.page),
            pageSize: Number(actual.pageSize),
            totalPages: Math.ceil(rows.length / Number(actual.pageSize)),
            totalRows: rows.length,
          },
        ],
      });
    },
  );
  return { requests, unexpected };
}
