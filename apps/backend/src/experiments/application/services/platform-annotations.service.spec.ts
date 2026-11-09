import { eq, profiles } from "@repo/database";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, assertFailure, assertSuccess, failure } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { AnnotationRecord } from "../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { PlatformAnnotationsService } from "./platform-annotations.service";

describe("PlatformAnnotationsService", () => {
  const testApp = TestHarness.App;
  let service: PlatformAnnotationsService;
  let experimentId: string;
  let userId: string;

  const created = new Date("2026-09-01T08:00:00.000Z");
  const phoneComment = {
    id: "p1",
    rowId: "1",
    type: "comment",
    content: { text: "From the phone", flagType: null },
  };

  function column(name: string, position: number) {
    return { name, type_name: "STRING", type_text: "STRING", position };
  }

  function page(columns: string[], rows: (string | null)[][]): SchemaData {
    return {
      columns: columns.map((name, position) => column(name, position)),
      rows,
      totalRows: rows.length,
      truncated: false,
    };
  }

  async function annotate(overrides: Partial<AnnotationRecord>): Promise<AnnotationRecord> {
    const record: AnnotationRecord = {
      id: "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      experimentId,
      tableName: "raw_data",
      rowId: "1",
      type: "flag",
      contentText: "Sensor fogged",
      flagType: "outlier",
      createdBy: userId,
      createdAt: created,
      updatedAt: created,
      ...overrides,
    };
    const repository = testApp.module.get(ExperimentAnnotationsRepository);
    assertSuccess(await repository.transaction((tx) => repository.insert(tx, [record])));
    return record;
  }

  /** How both read paths write a platform annotation in a cell. */
  function cell(record: AnnotationRecord, name: string | null) {
    return {
      id: record.id,
      rowId: record.rowId,
      type: record.type,
      content: { text: record.contentText, flagType: record.flagType },
      createdBy: record.createdBy,
      createdByName: name,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(PlatformAnnotationsService);
    userId = await testApp.createTestUser({});
    await testApp.database
      .update(profiles)
      .set({ firstName: "Ada", lastName: "Lovelace" })
      .where(eq(profiles.userId, userId));
    const { experiment } = await testApp.createExperiment({ name: "Drought trial", userId });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("adds the platform's annotations after the phone's in the store's cell", async () => {
    const flag = await annotate({});
    const data = page(
      ["id", "annotations"],
      [
        ["1", JSON.stringify([phoneComment])],
        ["2", "[]"],
      ],
    );

    const result = await service.fill({
      experimentId,
      tableName: "raw_data",
      data,
      phoneAnnotationsFrom: "annotations",
    });

    assertSuccess(result);
    expect(
      result.value.rows.map(([, annotations]): unknown => JSON.parse(annotations ?? "null")),
    ).toEqual([[phoneComment, cell(flag, "Ada Lovelace")], []]);
  });

  it("takes the phone's from the warehouse's own column, replaces the merged cell and drops that column", async () => {
    const flag = await annotate({});
    const merged = JSON.stringify([phoneComment, { id: "stale lakehouse copy" }]);
    const data = page(
      ["id", "annotations", "payload_annotations"],
      [["1", merged, JSON.stringify([phoneComment])]],
    );

    const result = await service.fill({
      experimentId,
      tableName: "raw_data",
      data,
      phoneAnnotationsFrom: "payload_annotations",
    });

    assertSuccess(result);
    expect(result.value.columns.map(({ name }) => name)).toEqual(["id", "annotations"]);
    expect(JSON.parse(result.value.rows[0][1] ?? "null")).toEqual([
      phoneComment,
      cell(flag, "Ada Lovelace"),
    ]);
  });

  it("shows only the platform's on a table the phone writes none to", async () => {
    const comment = await annotate({
      tableName: "4f0c6b1e-3a8e-4b7e-9c55-1d2e3f4a5b6c",
      type: "comment",
      flagType: null,
      contentText: "Wrong unit",
    });
    const data = page(["id", "annotations"], [["1", JSON.stringify([{ id: "lakehouse copy" }])]]);

    const result = await service.fill({
      experimentId,
      tableName: "4f0c6b1e-3a8e-4b7e-9c55-1d2e3f4a5b6c",
      data,
    });

    assertSuccess(result);
    expect(JSON.parse(result.value.rows[0][1] ?? "null")).toEqual([cell(comment, "Ada Lovelace")]);
  });

  it("matches a row by its table as well as its id", async () => {
    await annotate({ tableName: "4f0c6b1e-3a8e-4b7e-9c55-1d2e3f4a5b6c" });
    const data = page(["id", "annotations"], [["1", "[]"]]);

    const result = await service.fill({
      experimentId,
      tableName: "raw_data",
      data,
      phoneAnnotationsFrom: "annotations",
    });

    assertSuccess(result);
    expect(result.value.rows[0][1]).toBe("[]");
  });

  it("leaves a read without annotations as it is, apart from the phone's column", async () => {
    const data = page(["id", "payload_annotations"], [["1", "[]"]]);

    const result = await service.fill({
      experimentId,
      tableName: "raw_data",
      data,
      phoneAnnotationsFrom: "payload_annotations",
    });

    assertSuccess(result);
    expect(result.value).toEqual(page(["id"], [["1"]]));
  });

  it("fails the read when Postgres cannot answer", async () => {
    vi.spyOn(testApp.module.get(ExperimentAnnotationsRepository), "findOnRows").mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the annotations query")),
    );

    const result = await service.fill({
      experimentId,
      tableName: "raw_data",
      data: page(["id", "annotations"], [["1", "[]"]]),
      phoneAnnotationsFrom: "annotations",
    });

    assertFailure(result);
  });
});
