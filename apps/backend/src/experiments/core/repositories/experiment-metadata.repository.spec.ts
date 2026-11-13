import { faker } from "@faker-js/faker";

import { eq, experimentMetadataSheets, experiments } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { MetadataSheetRecord } from "../models/experiment-metadata.model";
import { ExperimentMetadataRepository } from "./experiment-metadata.repository";

describe("ExperimentMetadataRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentMetadataRepository;
  let experimentId: string;
  let userId: string;

  const created = new Date("2026-09-01T08:00:00.000Z");

  function sheet(overrides: Partial<MetadataSheetRecord> = {}): MetadataSheetRecord {
    return {
      id: faker.string.uuid(),
      experimentId,
      metadata: {
        name: "Plots",
        columns: [{ id: "plot", name: "plot", type: "string" }],
        rows: [{ _id: "r1", plot: "A1" }],
        identifierColumnId: "plot",
        experimentQuestionId: "plot",
      },
      createdBy: userId,
      createdAt: created,
      updatedAt: created,
      ...overrides,
    };
  }

  function stored(): Promise<MetadataSheetRecord[]> {
    return testApp.database.select().from(experimentMetadataSheets);
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentMetadataRepository);
    userId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Drought trial", userId });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("keeps a sheet with the id and times it was given", async () => {
    const plots = sheet();

    assertSuccess(await repository.insert(plots));

    expect(await stored()).toEqual([plots]);
  });

  it("keeps a sheet's values as they came, strings that look like JSON included", async () => {
    const plots = sheet({
      metadata: { name: "[1,2]", rows: [{ _id: "r1", depth: 0.1, note: null }] },
    });

    assertSuccess(await repository.insert(plots));

    expect(await stored()).toEqual([plots]);
  });

  it("replaces a sheet's document and its updated time, and nothing else", async () => {
    const plots = sheet();
    const later = new Date("2026-09-02T08:00:00.000Z");
    const edited = { ...plots.metadata, name: "Plots, corrected" };
    await repository.insert(plots);

    assertSuccess(await repository.update(experimentId, plots.id, edited, later));

    expect(await stored()).toEqual([{ ...plots, metadata: edited, updatedAt: later }]);
  });

  it("updates a sheet only in its experiment", async () => {
    const plots = sheet();
    await repository.insert(plots);

    assertSuccess(
      await repository.update(faker.string.uuid(), plots.id, { name: "Other" }, created),
    );

    expect(await stored()).toEqual([plots]);
  });

  it("deletes one sheet by its id, only in its experiment", async () => {
    const plots = sheet();
    await repository.insert(plots);

    assertSuccess(await repository.delete(faker.string.uuid(), plots.id));
    expect(await stored()).toHaveLength(1);

    assertSuccess(await repository.delete(experimentId, plots.id));
    expect(await stored()).toEqual([]);
  });

  it("goes with its experiment", async () => {
    await repository.insert(sheet());

    await testApp.database.delete(experiments).where(eq(experiments.id, experimentId));

    expect(await stored()).toEqual([]);
  });

  it("is refused a NUL character anywhere in the sheet, which jsonb cannot hold", async () => {
    const result = await repository.insert(
      sheet({ metadata: { rows: [{ _id: "r1", plot: "A\u00001" }] } }),
    );

    assertFailure(result);
    expect(result.error.message).toMatch(
      /^Postgres refused the metadata sheets query with SQLSTATE /,
    );
    expect(await stored()).toEqual([]);
  });

  it("is refused a NUL character in a key as well as in a value", async () => {
    const result = await repository.insert(
      sheet({ metadata: { rows: [{ _id: "r1", "plot\u0000": "A1" }] } }),
    );

    assertFailure(result);
    expect(await stored()).toEqual([]);
  });

  it("reports a refused write by Postgres's code, without the sheet in it", async () => {
    const plots = sheet({ metadata: { name: "Field 12, trampled" } });
    await repository.insert(plots);

    const result = await repository.insert(plots);

    assertFailure(result);
    expect(result.error.message).toBe(
      "Postgres refused the metadata sheets query with SQLSTATE 23505",
    );
  });

  it("reports a driver failure as no answer, not as an SQLSTATE", async () => {
    vi.spyOn(testApp.database, "insert").mockImplementation(() => {
      throw new Error("write failed", { cause: { code: "CONNECT_TIMEOUT" } });
    });

    const result = await repository.insert(sheet());

    assertFailure(result);
    expect(result.error.message).toBe("Postgres did not answer the metadata sheets query");
  });
});
