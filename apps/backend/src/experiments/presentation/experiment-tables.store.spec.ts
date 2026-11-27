import { readFileSync } from "fs";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type { ExperimentTablesMetadataList } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { dataFixture } from "../../test/data-fixtures";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";

/** The lines the feed writes for one experiment, table by table, which a data test pins. */
const FEED = z
  .record(z.string(), z.array(z.record(z.string(), z.unknown())))
  .parse(JSON.parse(readFileSync(dataFixture("serving_store_feed.json"), "utf-8")));

/** The measurements the feed writes for the fixture's experiment. */
const MEASUREMENTS = z
  .array(z.object({ processed_timestamp: z.string() }))
  .parse(FEED.measurements);

const zFeedAnnotations = z.array(z.record(z.string(), z.unknown()));

/** A store time, which is UTC, as the API writes it. */
function apiTime(storeTime: string): string {
  return new Date(`${storeTime.replace(" ", "T")}Z`).toISOString();
}

describe("The data page's tables, read afresh from the serving store", () => {
  const testApp = TestHarness.App;
  let ada: string;
  let ben: string;
  let experimentId: string;

  /** Inserts the feed's lines as this experiment's, each contributor as the user standing in for it. */
  async function seedFeed(experiment: string, contributors: Record<string, string>) {
    const contributor = (id: unknown) => (typeof id === "string" ? (contributors[id] ?? id) : id);

    for (const [table, lines] of Object.entries(FEED)) {
      await testApp.store.insert({
        table,
        values: lines.map((line) => ({
          ...line,
          experiment_id: experiment,
          ...("user_id" in line ? { user_id: contributor(line.user_id) } : {}),
          ...("annotations" in line
            ? {
                annotations: zFeedAnnotations.parse(line.annotations).map((annotation) => ({
                  ...annotation,
                  createdBy: contributor(annotation.createdBy),
                })),
              }
            : {}),
        })),
        format: "JSONEachRow",
        clickhouse_settings: { input_format_skip_unknown_fields: 0 },
      });
    }
  }

  async function rawData(userId: string) {
    const path = testApp.resolveOrpcPath(contract.experiments.getExperimentTables, {
      id: experimentId,
    });
    const response: SuperTestResponse<ExperimentTablesMetadataList> = await testApp
      .get(path)
      .withAuth(userId)
      .expect(StatusCodes.OK);
    return {
      source: response.headers["x-data-source"],
      table: response.body.find(({ identifier }) => identifier === "raw_data"),
    };
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
    const { experiment } = await testApp.createExperiment({ name: "Plots", userId: ada });
    experimentId = experiment.id;
    await testApp.addExperimentCollaborator(experimentId, ben);
    await seedFeed(experimentId, { u1: ada, u2: ben });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("counts a row the moment the feed writes it, with no cache between", async () => {
    const newest = MEASUREMENTS.map(({ processed_timestamp }) => processed_timestamp)
      .sort()
      .at(-1);

    const before = await rawData(ben);
    await testApp.store.insert({
      table: "measurements",
      values: [
        {
          experiment_id: experimentId,
          id: 99,
          timestamp: "2026-10-19 13:00:00",
          processed_timestamp: "2026-10-19 13:00:03",
          user_id: ada,
          questions_data: {},
          annotations: [],
          _commit_version: 2,
          _commit_timestamp: "2026-10-19 13:00:04",
        },
      ],
      format: "JSONEachRow",
    });
    const after = await rawData(ben);

    expect(before.source).toBe("store");
    expect(before.table).toMatchObject({
      totalRows: MEASUREMENTS.length,
      latestRowAt: newest === undefined ? null : apiTime(newest),
    });
    expect(after.table).toMatchObject({
      totalRows: MEASUREMENTS.length + 1,
      latestRowAt: apiTime("2026-10-19 13:00:03"),
    });
  });

  it("refuses the listing to someone who is not a member", async () => {
    const stranger = await testApp.createTestUser({ name: "Cleo Stranger" });
    const path = testApp.resolveOrpcPath(contract.experiments.getExperimentTables, {
      id: experimentId,
    });

    await testApp.get(path).withAuth(stranger).expect(StatusCodes.FORBIDDEN);
  });
});
