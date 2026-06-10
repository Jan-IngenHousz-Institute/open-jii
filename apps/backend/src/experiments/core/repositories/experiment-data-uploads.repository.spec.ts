/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";

import {
  success,
  failure,
  AppError,
  assertSuccess,
  assertFailure,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { UploadMetadata } from "../models/experiment-data-uploads.model";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { ExperimentDataUploadsRepository } from "./experiment-data-uploads.repository";

const METADATA_COLUMNS = [
  { name: "upload_id", type_name: "string", type_text: "string", position: 0 },
  { name: "experiment_id", type_name: "string", type_text: "string", position: 1 },
  { name: "upload_table_id", type_name: "string", type_text: "string", position: 2 },
  { name: "upload_table_name", type_name: "string", type_text: "string", position: 3 },
  { name: "source_kind", type_name: "string", type_text: "string", position: 4 },
  { name: "status", type_name: "string", type_text: "string", position: 5 },
  { name: "file_count", type_name: "int", type_text: "int", position: 6 },
  { name: "row_count", type_name: "bigint", type_text: "bigint", position: 7 },
  { name: "created_by", type_name: "string", type_text: "string", position: 8 },
  { name: "created_at", type_name: "string", type_text: "string", position: 9 },
  { name: "completed_at", type_name: "string", type_text: "string", position: 10 },
  { name: "error_message", type_name: "string", type_text: "string", position: 11 },
];

describe("ExperimentDataUploadsRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataUploadsRepository;
  let databricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataUploadsRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("validateTargetTable", () => {
    const experimentId = faker.string.uuid();
    const existingUploadTableId = "11111111-1111-1111-1111-111111111111";

    it("mints a new uploadTableId for a 'new' target when no name collides", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "leaf_traits" },
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.uploadTableName).toBe("leaf_traits");
      expect(result.value.uploadTableId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(databricksPort.getExperimentTableMetadata).toHaveBeenCalledWith(experimentId, {
        includeSchemas: false,
      });
    });

    it("returns conflict for a 'new' target whose name already exists in this experiment", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: existingUploadTableId,
            tableType: "upload",
            displayName: "leaf_traits",
            rowCount: 10,
          },
        ]),
      );

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "leaf_traits" },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("UPLOAD_TABLE_NAME_TAKEN");
    });

    it("rejects a 'new' target whose name collides with a reserved system table", async () => {
      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "raw_data" },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("BAD_REQUEST");
      expect(result.error.message).toContain("reserved");
    });

    it("resolves an 'existing' target's display name from experiment_table_metadata", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: existingUploadTableId,
            tableType: "upload",
            displayName: "leaf_traits",
            rowCount: 1000,
          },
        ]),
      );

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "existing", uploadTableId: existingUploadTableId },
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        uploadTableId: existingUploadTableId,
        uploadTableName: "leaf_traits",
      });
    });

    it("returns not-found for an 'existing' target id that the metadata table doesn't know", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "existing", uploadTableId: existingUploadTableId },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("rejects an 'existing' target id that points at a non-upload table", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: existingUploadTableId,
            tableType: "macro",
            displayName: null,
            rowCount: 5,
          },
        ]),
      );

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "existing", uploadTableId: existingUploadTableId },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("propagates metadata fetch failures", async () => {
      const error = AppError.internal("Databricks unavailable");
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(failure(error));

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "leaf_traits" },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBe(error);
    });
  });

  describe("listUploads", () => {
    const experimentId = faker.string.uuid();
    const uploadTableId = "11111111-1111-1111-1111-111111111111";

    function row(overrides: Partial<Record<string, string | null>> = {}): (string | null)[] {
      return [
        overrides.upload_id ?? "u1",
        overrides.experiment_id ?? experimentId,
        overrides.upload_table_id ?? uploadTableId,
        overrides.upload_table_name ?? "leaf_traits",
        overrides.source_kind ?? "csv",
        overrides.status ?? "completed",
        overrides.file_count ?? "1",
        overrides.row_count ?? "10",
        overrides.created_by ?? "user-1",
        overrides.created_at ?? "2026-01-01T00:00:00Z",
        overrides.completed_at ?? "2026-01-01T00:05:00Z",
        overrides.error_message ?? null,
      ];
    }

    it("returns active, failed, and completed uploads in that order, deduped by upload_id", async () => {
      const completedId = faker.string.uuid();
      const failedOnlyId = faker.string.uuid();
      const activeId = faker.string.uuid();

      vi.spyOn(databricksPort, "getUploadMetadata").mockResolvedValue(
        success({
          columns: METADATA_COLUMNS,
          rows: [row({ upload_id: completedId })],
          totalRows: 1,
          truncated: false,
        }),
      );

      const activeUpload: UploadMetadata = {
        uploadId: activeId,
        experimentId,
        uploadTableId,
        uploadTableName: "leaf_traits",
        sourceKind: "csv",
        status: "running",
        fileCount: null,
        rowCount: null,
        createdBy: "user-2",
        createdAt: "2026-01-02T00:00:00Z",
        completedAt: null,
        errorMessage: null,
      };

      const failedUpload: UploadMetadata = {
        uploadId: failedOnlyId,
        experimentId,
        uploadTableId,
        uploadTableName: "leaf_traits",
        sourceKind: "csv",
        status: "failed",
        fileCount: null,
        rowCount: null,
        createdBy: "user-3",
        createdAt: "2026-01-03T00:00:00Z",
        completedAt: "2026-01-03T00:01:00Z",
        errorMessage: null,
      };

      vi.spyOn(databricksPort, "getActiveUploads").mockResolvedValue(success([activeUpload]));
      vi.spyOn(databricksPort, "getFailedUploads").mockResolvedValue(success([failedUpload]));

      const result = await repository.listUploads({ experimentId });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.map((u) => u.uploadId)).toEqual([activeId, failedOnlyId, completedId]);

      expect(databricksPort.getFailedUploads).toHaveBeenCalledWith(
        experimentId,
        new Set([completedId]),
        { uploadTableId: undefined, uploadTableName: undefined },
      );
    });

    it("falls back to completed-only when getActiveUploads fails", async () => {
      vi.spyOn(databricksPort, "getUploadMetadata").mockResolvedValue(
        success({
          columns: METADATA_COLUMNS,
          rows: [row({ upload_id: "u1" })],
          totalRows: 1,
          truncated: false,
        }),
      );
      vi.spyOn(databricksPort, "getActiveUploads").mockResolvedValue(
        failure(AppError.internal("Job-runs API failure")),
      );

      const result = await repository.listUploads({ experimentId });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].uploadId).toBe("u1");
      expect(result.value[0].uploadTableId).toBe(uploadTableId);
    });

    it("propagates failure from getUploadMetadata", async () => {
      const error = AppError.internal("SQL failure");
      vi.spyOn(databricksPort, "getUploadMetadata").mockResolvedValue(failure(error));

      const result = await repository.listUploads({ experimentId });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBe(error);
    });

    it("forwards uploadTableId + uploadTableName filters to all three port calls", async () => {
      vi.spyOn(databricksPort, "getUploadMetadata").mockResolvedValue(
        success({ columns: METADATA_COLUMNS, rows: [], totalRows: 0, truncated: false }),
      );
      vi.spyOn(databricksPort, "getActiveUploads").mockResolvedValue(success([]));
      vi.spyOn(databricksPort, "getFailedUploads").mockResolvedValue(success([]));

      await repository.listUploads({ experimentId, uploadTableId, uploadTableName: "leaf_traits" });

      const expectedFilter = { uploadTableId, uploadTableName: "leaf_traits" };
      expect(databricksPort.getUploadMetadata).toHaveBeenCalledWith(experimentId, expectedFilter);
      expect(databricksPort.getActiveUploads).toHaveBeenCalledWith(experimentId, expectedFilter);
      expect(databricksPort.getFailedUploads).toHaveBeenCalledWith(
        experimentId,
        new Set<string>(),
        expectedFilter,
      );
    });
  });
});
