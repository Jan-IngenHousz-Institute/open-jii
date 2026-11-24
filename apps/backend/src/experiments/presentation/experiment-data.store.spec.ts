import { createHash } from "crypto";
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

/** The lines the feed writes for one experiment, table by table, which a data test pins. */
const FEED = z
  .record(z.string(), z.array(z.record(z.string(), z.unknown())))
  .parse(JSON.parse(readFileSync(dataFixture("serving_store_feed.json"), "utf-8")));

/** The measurements the feed writes for the fixture's experiment, as the page should show them. */
const MEASUREMENTS = z
  .array(
    z.object({
      id: z.number(),
      timestamp: z.string(),
      questions_data: z.object({ plot: z.string() }),
    }),
  )
  .parse(FEED.measurements);

const zFeedAnnotations = z.array(z.record(z.string(), z.unknown()));

const zContributor = z.object({ id: z.string(), name: z.string() });
const zAnnotations = z.array(
  z.object({
    content: z.object({ text: z.string().nullable() }),
    createdBy: z.string().nullish(),
    createdByName: z.string().nullish(),
  }),
);

describe("The data page, read from the serving store", () => {
  const testApp = TestHarness.App;
  let ada: string;
  let ben: string;

  /** Inserts the feed's lines as this experiment's, each contributor as the user standing in for it. */
  async function seedFeed(experimentId: string, contributors: Record<string, string>) {
    const contributor = (id: unknown) => (typeof id === "string" ? (contributors[id] ?? id) : id);

    for (const [table, lines] of Object.entries(FEED)) {
      await testApp.store.insert({
        table,
        values: lines.map((line) => ({
          ...line,
          experiment_id: experimentId,
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

  /** A private experiment of Ada's, Ben a member of it, whose rows the feed wrote to the store. */
  async function experimentInStore(options: { anonymizeContributors?: boolean } = {}) {
    const { experiment } = await testApp.createExperiment({
      name: "Plots",
      userId: ada,
      ...options,
    });
    await testApp.addExperimentCollaborator(experiment.id, ben);
    await seedFeed(experiment.id, { u1: ada, u2: ben });
    return experiment.id;
  }

  async function page(experimentId: string, userId: string, query: Record<string, string> = {}) {
    const path = testApp.resolveOrpcPath(contract.experiments.getExperimentData, {
      id: experimentId,
    });
    const response: SuperTestResponse<ExperimentDataResponse> = await testApp
      .get(path)
      .query({ tableName: "raw_data", page: "1", pageSize: "10", ...query })
      .withAuth(userId)
      .expect(StatusCodes.OK);
    const [table] = response.body;
    return table.data?.rows ?? [];
  }

  function cells(rows: Record<string, unknown>[], column: string): unknown[] {
    return rows.map((row) => row[column]);
  }

  function contributorNames(rows: Record<string, unknown>[]): string[] {
    return rows.map((row) => zContributor.parse(JSON.parse(String(row.contributor))).name);
  }

  function annotationTexts(rows: Record<string, unknown>[]): (string | null)[][] {
    return rows.map((row) =>
      zAnnotations.parse(JSON.parse(String(row.annotations))).map(({ content }) => content.text),
    );
  }

  function annotationAuthors(rows: Record<string, unknown>[]): (string | null)[][][] {
    return rows.map((row) =>
      zAnnotations
        .parse(JSON.parse(String(row.annotations)))
        .map(({ createdBy, createdByName }) => [createdBy ?? null, createdByName ?? null]),
    );
  }

  /** A comment a member adds to a row on the page, which Postgres holds. */
  async function annotate(experimentId: string, userId: string, rowId: string, text: string) {
    const path = testApp.resolveOrpcPath(contract.experiments.addAnnotation, { id: experimentId });
    await testApp
      .post(path)
      .withAuth(userId)
      .send({
        tableName: "raw_data",
        rowId,
        annotation: { type: "comment", content: { type: "comment", text } },
      })
      .expect(StatusCodes.CREATED);
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
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("shows a member the rows with names, annotations and custom metadata from Postgres and the store", async () => {
    const experimentId = await experimentInStore();
    await annotate(experimentId, ben, "2", "wilted");

    const rows = await page(experimentId, ben);

    expect(cells(rows, "id")).toEqual(MEASUREMENTS.map(({ id }) => String(id)));
    expect(cells(rows, "plot")).toEqual(
      MEASUREMENTS.map(({ questions_data }) => questions_data.plot),
    );
    expect(contributorNames(rows)).toEqual(["Ada Lovelace", "Ben Okri", "Ada Lovelace"]);
    expect(annotationTexts(rows)).toEqual([["leaf torn"], ["wilted"], []]);
    expect(cells(rows, "soil")).toEqual(["clay", "sand", "clay"]);
  });

  it("refuses someone who is not a member", async () => {
    const experimentId = await experimentInStore();
    const stranger = await testApp.createTestUser({ name: "Cleo Stranger" });
    const path = testApp.resolveOrpcPath(contract.experiments.getExperimentData, {
      id: experimentId,
    });

    await testApp
      .get(path)
      .query({ tableName: "raw_data", page: "1", pageSize: "10" })
      .withAuth(stranger)
      .expect(StatusCodes.FORBIDDEN);
  });

  it("shows pseudonyms for contributors and annotation authors on an anonymized experiment", async () => {
    const experimentId = await experimentInStore({ anonymizeContributors: true });
    await annotate(experimentId, ben, "2", "wilted");
    // The pseudonym of an experiment's contributor, as the anonymizer and the SQL filter write it.
    const pseudonymOf = (userId: string) => {
      const digest = createHash("sha256").update(`${experimentId}:${userId}`).digest("hex");
      return `Contributor-${digest.slice(0, 6).toUpperCase()}`;
    };

    const rows = await page(experimentId, ben);

    expect(contributorNames(rows)).toEqual([pseudonymOf(ada), pseudonymOf(ben), pseudonymOf(ada)]);
    expect(annotationAuthors(rows)).toEqual([
      [[pseudonymOf(ada), pseudonymOf(ada)]],
      [[pseudonymOf(ben), pseudonymOf(ben)]],
      [],
    ]);
    const shown = JSON.stringify(rows);
    for (const identity of [ada, ben, "Ada", "Ben"]) {
      expect(shown).not.toContain(identity);
    }
  });

  it("filters and sorts the rows as the feed's rows say", async () => {
    const experimentId = await experimentInStore();

    const inA1 = await page(experimentId, ben, {
      filters: JSON.stringify([{ column: "plot", operator: "equals", value: "A1" }]),
    });
    const newestFirst = await page(experimentId, ben, {
      orderBy: "timestamp",
      orderDirection: "DESC",
    });

    expect(cells(inA1, "id")).toEqual(
      MEASUREMENTS.filter(({ questions_data }) => questions_data.plot === "A1").map(({ id }) =>
        String(id),
      ),
    );
    expect(cells(newestFirst, "id")).toEqual(
      [...MEASUREMENTS]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .map(({ id }) => String(id)),
    );
  });
});
