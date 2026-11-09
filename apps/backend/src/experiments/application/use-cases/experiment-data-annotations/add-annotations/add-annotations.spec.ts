import type { ExperimentAddAnnotationsBulkBody } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { experimentAnnotations, experimentDataOutbox } from "@repo/database";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentDataOutboxWorker } from "../../../services/experiment-data-outbox.worker";
import { AddAnnotationsUseCase } from "./add-annotations";

describe("AddAnnotations", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddAnnotationsUseCase;

  const comment: ExperimentAddAnnotationsBulkBody = {
    tableName: "raw_data",
    rowIds: ["row1", "row2"],
    annotation: { type: "comment", content: { type: "comment", text: "Leaf was wet" } },
  };

  function annotations() {
    return testApp.database.select().from(experimentAnnotations);
  }

  function outbox() {
    return testApp.database.select().from(experimentDataOutbox);
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AddAnnotationsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("keeps a comment on each row and owes each one's copy, then starts the copy", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    const result = await useCase.execute(experiment.id, comment, testUserId);

    assertSuccess(result);
    expect(result.value).toEqual({ rowsAffected: 2 });
    const kept = await annotations();
    expect(kept.map((annotation) => annotation.rowId).sort()).toEqual(["row1", "row2"]);
    expect(kept[0]).toEqual(
      expect.objectContaining({
        experimentId: experiment.id,
        tableName: "raw_data",
        type: "comment",
        contentText: "Leaf was wet",
        flagType: null,
        createdBy: testUserId,
      }),
    );
    expect(kept[0].createdAt).toEqual(kept[0].updatedAt);
    expect(
      (await outbox()).map((row) => [row.recordType, row.recordId, row.destination]).sort(),
    ).toEqual(kept.map((annotation) => ["annotation", annotation.id, "lakehouse"]).sort());
    expect(nudge).toHaveBeenCalledTimes(1);
  });

  it("keeps a flag with its type and no text when none was given", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });

    assertSuccess(
      await useCase.execute(
        experiment.id,
        {
          tableName: "raw_data",
          rowIds: ["row1"],
          annotation: { type: "flag", content: { type: "flag", flagType: "outlier" } },
        },
        testUserId,
      ),
    );

    expect(await annotations()).toEqual([
      expect.objectContaining({ type: "flag", flagType: "outlier", contentText: null }),
    ]);
  });

  it("keeps a flag's text when one was given", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });

    assertSuccess(
      await useCase.execute(
        experiment.id,
        {
          tableName: "raw_data",
          rowIds: ["row1"],
          annotation: {
            type: "flag",
            content: { type: "flag", flagType: "needs_review", text: "Sensor fogged" },
          },
        },
        testUserId,
      ),
    );

    expect(await annotations()).toEqual([
      expect.objectContaining({ flagType: "needs_review", contentText: "Sensor fogged" }),
    ]);
  });

  it("refuses a request without a user, and writes nothing", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });

    const result = await useCase.execute(experiment.id, comment, "");

    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(await annotations()).toEqual([]);
  });

  it("answers not found for an experiment that does not exist", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      comment,
      testUserId,
    );

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("fails, and owes no copy, when Postgres refuses the annotations", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    vi.spyOn(testApp.module.get(ExperimentAnnotationsRepository), "transaction").mockResolvedValue(
      failure(AppError.internal("Postgres refused the annotations query with SQLSTATE 23505")),
    );
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    const result = await useCase.execute(experiment.id, comment, testUserId);

    assertFailure(result);
    expect(result.error.message).toBe("Postgres refused the annotations query with SQLSTATE 23505");
    expect(await outbox()).toEqual([]);
    expect(nudge).not.toHaveBeenCalled();
  });

  it("keeps no annotation when the copy it owes cannot be written", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "owe").mockRejectedValue(
      new Error("outbox unavailable"),
    );
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    const result = await useCase.execute(experiment.id, comment, testUserId);

    assertFailure(result);
    expect(await annotations()).toEqual([]);
    expect(await outbox()).toEqual([]);
    expect(nudge).not.toHaveBeenCalled();
  });
});
