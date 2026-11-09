import { faker } from "@faker-js/faker";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { AnnotationCopy } from "../models/experiment-data-annotation.model";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { ExperimentAnnotationsWarehouseRepository } from "./experiment-annotations-warehouse.repository";

describe("ExperimentAnnotationsWarehouseRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentAnnotationsWarehouseRepository;
  let databricksPort: DatabricksPort;

  const created = new Date("2026-09-01T08:00:00.000Z");
  const updated = new Date("2026-09-02T08:00:00.000Z");
  const nothing: SchemaData = { columns: [], rows: [], totalRows: 0, truncated: false };

  function copy(overrides: Partial<AnnotationCopy> = {}): AnnotationCopy {
    return {
      id: faker.string.uuid(),
      experimentId: faker.string.uuid(),
      tableName: "raw_data",
      rowId: "1",
      type: "comment",
      contentText: "Leaf was wet",
      flagType: null,
      createdBy: faker.string.uuid(),
      createdAt: created,
      updatedAt: updated,
      userName: "Ada Lovelace",
      ...overrides,
    };
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("merge", () => {
    it("writes every annotation in one statement, updating the ones the copy has", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));
      const comment = copy();
      const flag = copy({ type: "flag", flagType: "outlier", contentText: null, userName: null });

      assertSuccess(await repository.merge([comment, flag]));

      expect(execute).toHaveBeenCalledTimes(1);
      const [, statement, parameters] = execute.mock.calls[0];
      expect(statement).toContain("MERGE INTO experiment_annotations AS target");
      expect(statement).toContain("ON target.id = source.id");
      expect(statement).toContain("WHEN MATCHED THEN UPDATE SET");
      expect(statement).toContain("WHEN NOT MATCHED THEN INSERT");
      expect(parameters).toEqual(
        expect.arrayContaining([
          { name: "id_0", value: comment.id },
          { name: "user_id_0", value: comment.createdBy },
          { name: "user_name_0", value: "Ada Lovelace" },
          { name: "content_text_0", value: "Leaf was wet" },
          { name: "created_at_0", value: created.toISOString(), type: "TIMESTAMP" },
          { name: "updated_at_0", value: updated.toISOString(), type: "TIMESTAMP" },
          { name: "id_1", value: flag.id },
          { name: "flag_type_1", value: "outlier" },
          { name: "user_name_1", value: undefined },
          { name: "content_text_1", value: undefined },
        ]),
      );
    });

    it("keeps the annotations' text out of the statement", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));

      assertSuccess(await repository.merge([copy({ contentText: "farmer's plot \\ north" })]));

      expect(execute.mock.calls[0][1]).not.toContain("farmer");
    });

    it("sends nothing when there is nothing to write", async () => {
      const execute = vi.spyOn(databricksPort, "executeSqlQuery");

      assertSuccess(await repository.merge([]));

      expect(execute).not.toHaveBeenCalled();
    });

    it("fails when the warehouse refuses the statement", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      const result = await repository.merge([copy()]);

      assertFailure(result);
      expect(result.error.message).toBe("Failed to merge annotations: Warehouse down");
    });
  });

  describe("delete", () => {
    it("deletes the copies by id in one statement", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));
      const ids = [faker.string.uuid(), faker.string.uuid()];

      assertSuccess(await repository.delete(ids));

      const [, statement, parameters] = execute.mock.calls[0];
      expect(statement).toContain("DELETE FROM experiment_annotations");
      expect(statement).toContain("WHERE id IN (:id_0, :id_1)");
      expect(parameters).toEqual([
        { name: "id_0", value: ids[0] },
        { name: "id_1", value: ids[1] },
      ]);
    });

    it("sends nothing when nothing is gone", async () => {
      const execute = vi.spyOn(databricksPort, "executeSqlQuery");

      assertSuccess(await repository.delete([]));

      expect(execute).not.toHaveBeenCalled();
    });

    it("fails when the warehouse refuses the statement", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      const result = await repository.delete([faker.string.uuid()]);

      assertFailure(result);
      expect(result.error.message).toBe("Failed to delete annotations: Warehouse down");
    });
  });
});
