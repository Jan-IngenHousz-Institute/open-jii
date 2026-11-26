import { readFileSync } from "fs";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type { ExperimentDataResponse } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { dataFixture } from "../../test/data-fixtures";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";

/** The macro table the chart parity fixture's rows land in. */
const MACRO = "m1";

/** The experiment the chart parity fixture's rows belong to unless a row names another. */
const CHART_EXPERIMENT = "charts";

const zParityRow = z.object({
  experiment: z.string().optional(),
  id: z.number(),
  timestamp: z.string(),
  device_name: z.string().nullable(),
  latitude: z.number().nullable(),
  output: z.string(),
});

const PARITY = z
  .object({
    schema: z.string(),
    rows: z.array(zParityRow),
    matchSchema: z.string(),
    matches: z.array(zParityRow),
    cases: z.object({
      groupedStats: z.object({
        aggregation: z.unknown(),
        ordering: z.object({ column: z.string(), direction: z.enum(["ASC", "DESC"]) }),
      }),
    }),
  })
  .parse(JSON.parse(readFileSync(dataFixture("chart-parity.json"), "utf-8")));

/** What Spark returned for the case, worked out in the data tests. */
const GROUPED_STATS = z
  .object({
    groupedStats: z.object({
      columns: z.array(z.string()),
      types: z.array(z.string()),
      rows: z.array(z.array(z.union([z.number(), z.string(), z.null()]))),
    }),
  })
  .parse(JSON.parse(readFileSync(dataFixture("chart-results.json"), "utf-8"))).groupedStats;

/** Each row of the fixture's own experiment with the value it plots, by id. */
const SERIES = PARITY.rows
  .filter((row) => row.experiment === undefined)
  .map((row) => ({
    id: row.id,
    v: z.object({ v: z.number().nullish() }).parse(JSON.parse(row.output)).v ?? null,
  }))
  .sort((a, b) => a.id - b.id);

/** A cell as the type it holds, numbers compared within what their rounding allows. */
function expectCell(cell: unknown, type: string, expected: number | string | null): void {
  const isNumber = ["BIGINT", "INT", "DOUBLE"].includes(type);
  if (cell === null || !isNumber || typeof expected !== "number") {
    expect(cell).toEqual(expected === null ? null : String(expected));
    return;
  }
  expect(Number(cell)).toBeCloseTo(expected, 9);
}

describe("A chart read from the serving store", () => {
  const testApp = TestHarness.App;
  let ada: string;
  let ben: string;
  let experimentId: string;

  /** The fixture's macro rows and their schemas, as the feed writes them, its own rows this experiment's. */
  async function seedChartParity() {
    const experimentOf = (name = CHART_EXPERIMENT) =>
      name === CHART_EXPERIMENT ? experimentId : name;
    const macroRow = (macroId: string) => (row: z.infer<typeof zParityRow>) => ({
      experiment_id: experimentOf(row.experiment),
      id: row.id,
      raw_id: row.id,
      timestamp: row.timestamp,
      device_name: row.device_name,
      latitude: row.latitude,
      macro_id: macroId,
      macro_output: z.record(z.string(), z.unknown()).parse(JSON.parse(row.output)),
      macro_output_text: row.output,
      questions_data: {},
      annotations: [],
      _commit_version: 1,
      _commit_timestamp: "2027-01-02 00:00:00",
    });
    const schemas = (macroId: string, schema: string, rows: z.infer<typeof zParityRow>[]) =>
      [...new Set(rows.map((row) => experimentOf(row.experiment)))].map((experiment) => ({
        experiment_id: experiment,
        table_type: "macro",
        identifier: macroId,
        payload: "macro_output",
        schema,
        _commit_version: 1,
      }));

    await testApp.store.insert({
      table: "macro_results",
      values: [...PARITY.rows.map(macroRow(MACRO)), ...PARITY.matches.map(macroRow("m2"))],
      format: "JSONEachRow",
    });
    await testApp.store.insert({
      table: "payload_schemas",
      values: [
        ...schemas(MACRO, PARITY.schema, PARITY.rows),
        ...schemas("m2", PARITY.matchSchema, PARITY.matches),
      ],
      format: "JSONEachRow",
    });
  }

  async function chartRows(userId: string, query: Record<string, string>) {
    const path = testApp.resolveOrpcPath(contract.experiments.getExperimentData, {
      id: experimentId,
    });
    const response: SuperTestResponse<ExperimentDataResponse> = await testApp
      .get(path)
      .query({ tableName: MACRO, ...query })
      .withAuth(userId)
      .expect(StatusCodes.OK);
    const [table] = response.body;
    return table.data?.rows ?? [];
  }

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    const analytics: MockAnalyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analytics.setFlag(FEATURE_FLAGS.STORE_EXPERIMENT_READS, true);

    ada = await testApp.createTestUser({ name: "Ada Lovelace" });
    ben = await testApp.createTestUser({ name: "Ben Okri" });
    const { experiment } = await testApp.createExperiment({ name: "Charts", userId: ada });
    experimentId = experiment.id;
    await testApp.addExperimentCollaborator(experimentId, ben);
    await seedChartParity();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("aggregates a member's chart as Spark aggregates the same rows", async () => {
    const { aggregation, ordering } = PARITY.cases.groupedStats;

    const rows = await chartRows(ben, {
      aggregation: JSON.stringify(aggregation),
      orderBy: ordering.column,
      orderDirection: ordering.direction,
    });

    expect(rows).toHaveLength(GROUPED_STATS.rows.length);
    GROUPED_STATS.rows.forEach((expected, rowIndex) =>
      GROUPED_STATS.columns.forEach((column, index) =>
        expectCell(rows[rowIndex][column], GROUPED_STATS.types[index], expected[index]),
      ),
    );
  });

  it("plots a member's raw series as the rows hold it", async () => {
    const rows = await chartRows(ben, { columns: "id,v", orderBy: "id", orderDirection: "ASC" });

    expect(rows.map((row) => row.id)).toEqual(SERIES.map(({ id }) => String(id)));
    rows.forEach((row, index) => expectCell(row.v, "DOUBLE", SERIES[index].v));
  });

  it("refuses someone who is not a member", async () => {
    const stranger = await testApp.createTestUser({ name: "Cleo Stranger" });
    const path = testApp.resolveOrpcPath(contract.experiments.getExperimentData, {
      id: experimentId,
    });

    await testApp
      .get(path)
      .query({ tableName: MACRO, columns: "id,v" })
      .withAuth(stranger)
      .expect(StatusCodes.FORBIDDEN);
  });
});
