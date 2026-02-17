/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import { Readable } from "stream";

import {
  success,
  failure,
  AppError,
  assertSuccess,
  assertFailure,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { ExportMetadata } from "../../core/models/experiment-data-exports.model";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import { ExperimentDataExportsRepository } from "./experiment-data-exports.repository";

describe("ExperimentDataExportsRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataExportsRepository;
  let databricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataExportsRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("initiateExport", () => {
    const exportId = faker.string.uuid();
    const experimentId = faker.string.uuid();
    const tableName = "raw_data";
    const format = "csv";
    const userId = faker.string.uuid();

    it("should successfully trigger the data export job", async () => {
      const mockJobRunResponse = { run_id: 12345, number_in_job: 1 };

      vi.spyOn(databricksPort, "triggerDataExportJob").mockResolvedValue(
        success(mockJobRunResponse),
      );

      const result = await repository.initiateExport({
        exportId,
        experimentId,
        tableName,
        format,
        userId,
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();

      expect(databricksPort.triggerDataExportJob).toHaveBeenCalledWith(
        experimentId,
        tableName,
        format,
        exportId,
        userId,
      );
    });

    it("should return failure when triggerDataExportJob fails", async () => {
      const error = AppError.internal("Job trigger failed");
      vi.spyOn(databricksPort, "triggerDataExportJob").mockResolvedValue(failure(error));

      const result = await repository.initiateExport({
        exportId,
        experimentId,
        tableName,
        format,
        userId,
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBe(error);
    });
  });

  describe("listExports", () => {
    const experimentId = faker.string.uuid();
    const tableName = "raw_data";

    it("should return merged active and completed exports", async () => {
      // Mock completed exports from Delta Lake
      const mockSchemaData = {
        columns: [
          { name: "export_id", type_name: "string", type_text: "string", position: 0 },
          { name: "experiment_id", type_name: "string", type_text: "string", position: 1 },
          { name: "table_name", type_name: "string", type_text: "string", position: 2 },
          { name: "format", type_name: "string", type_text: "string", position: 3 },
          { name: "status", type_name: "string", type_text: "string", position: 4 },
          { name: "file_path", type_name: "string", type_text: "string", position: 5 },
          { name: "row_count", type_name: "bigint", type_text: "bigint", position: 6 },
          { name: "file_size", type_name: "bigint", type_text: "bigint", position: 7 },
          { name: "created_by", type_name: "string", type_text: "string", position: 8 },
          { name: "created_at", type_name: "string", type_text: "string", position: 9 },
          { name: "completed_at", type_name: "string", type_text: "string", position: 10 },
          { name: "job_run_id", type_name: "bigint", type_text: "bigint", position: 11 },
        ],
        rows: [
          [
            "completed-export-1",
            experimentId,
            tableName,
            "csv",
            "completed",
            "/path/to/file.csv",
            "1000",
            "50000",
            "user-1",
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:05:00Z",
            "111",
          ],
        ],
        totalRows: 1,
        truncated: false,
      };

      // Mock active exports from job runs
      const mockActiveExports: ExportMetadata[] = [
        {
          exportId: null,
          experimentId,
          tableName,
          format: "json",
          status: "running",
          filePath: null,
          rowCount: null,
          fileSize: null,
          createdBy: "user-2",
          createdAt: "2026-01-02T00:00:00Z",
          completedAt: null,
          jobRunId: 222,
        },
      ];

      vi.spyOn(databricksPort, "getExportMetadata").mockResolvedValue(success(mockSchemaData));
      vi.spyOn(databricksPort, "getActiveExports").mockResolvedValue(success(mockActiveExports));

      const result = await repository.listExports({ experimentId, tableName });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Active exports should come first
      expect(result.value).toHaveLength(2);
      expect(result.value[0].status).toBe("running");
      expect(result.value[0].exportId).toBeNull();
      expect(result.value[1].status).toBe("completed");
      expect(result.value[1].exportId).toBe("completed-export-1");
    });

    it("should return only completed exports when getActiveExports fails", async () => {
      const mockSchemaData = {
        columns: [
          { name: "export_id", type_name: "string", type_text: "string", position: 0 },
          { name: "experiment_id", type_name: "string", type_text: "string", position: 1 },
          { name: "table_name", type_name: "string", type_text: "string", position: 2 },
          { name: "format", type_name: "string", type_text: "string", position: 3 },
          { name: "status", type_name: "string", type_text: "string", position: 4 },
          { name: "file_path", type_name: "string", type_text: "string", position: 5 },
          { name: "row_count", type_name: "bigint", type_text: "bigint", position: 6 },
          { name: "file_size", type_name: "bigint", type_text: "bigint", position: 7 },
          { name: "created_by", type_name: "string", type_text: "string", position: 8 },
          { name: "created_at", type_name: "string", type_text: "string", position: 9 },
          { name: "completed_at", type_name: "string", type_text: "string", position: 10 },
          { name: "job_run_id", type_name: "bigint", type_text: "bigint", position: 11 },
        ],
        rows: [
          [
            "export-1",
            experimentId,
            tableName,
            "csv",
            "completed",
            "/path/file.csv",
            "500",
            "25000",
            "user-1",
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:05:00Z",
            "111",
          ],
        ],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExportMetadata").mockResolvedValue(success(mockSchemaData));
      vi.spyOn(databricksPort, "getActiveExports").mockResolvedValue(
        failure(AppError.internal("Failed to list runs")),
      );

      const result = await repository.listExports({ experimentId, tableName });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].exportId).toBe("export-1");
    });

    it("should return failure when getExportMetadata fails", async () => {
      const error = AppError.internal("SQL execution failed");
      vi.spyOn(databricksPort, "getExportMetadata").mockResolvedValue(failure(error));

      const result = await repository.listExports({ experimentId, tableName });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBe(error);
    });

    it("should return empty array when no exports exist", async () => {
      const mockSchemaData = {
        columns: [
          { name: "export_id", type_name: "string", type_text: "string", position: 0 },
          { name: "experiment_id", type_name: "string", type_text: "string", position: 1 },
          { name: "table_name", type_name: "string", type_text: "string", position: 2 },
          { name: "format", type_name: "string", type_text: "string", position: 3 },
          { name: "status", type_name: "string", type_text: "string", position: 4 },
          { name: "file_path", type_name: "string", type_text: "string", position: 5 },
          { name: "row_count", type_name: "bigint", type_text: "bigint", position: 6 },
          { name: "file_size", type_name: "bigint", type_text: "bigint", position: 7 },
          { name: "created_by", type_name: "string", type_text: "string", position: 8 },
          { name: "created_at", type_name: "string", type_text: "string", position: 9 },
          { name: "completed_at", type_name: "string", type_text: "string", position: 10 },
          { name: "job_run_id", type_name: "bigint", type_text: "bigint", position: 11 },
        ],
        rows: [],
        totalRows: 0,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExportMetadata").mockResolvedValue(success(mockSchemaData));
      vi.spyOn(databricksPort, "getActiveExports").mockResolvedValue(success([]));

      const result = await repository.listExports({ experimentId, tableName });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });
  });

  describe("downloadExport", () => {
    const experimentId = faker.string.uuid();
    const exportId = faker.string.uuid();

    it("should successfully download an export file", async () => {
      const mockStream = new Readable({
        read() {
          this.push("test data");
          this.push(null);
        },
      });
      const mockFilePath = "/path/to/exported/file.csv";

      vi.spyOn(databricksPort, "streamExport").mockResolvedValue(
        success({ stream: mockStream, filePath: mockFilePath }),
      );

      const result = await repository.downloadExport({ experimentId, exportId });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.filePath).toBe(mockFilePath);
      expect(result.value.stream).toBe(mockStream);

      expect(databricksPort.streamExport).toHaveBeenCalledWith(exportId, experimentId);
    });

    it("should return failure when streamExport fails", async () => {
      const error = AppError.notFound("Export not found");
      vi.spyOn(databricksPort, "streamExport").mockResolvedValue(failure(error));

      const result = await repository.downloadExport({ experimentId, exportId });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBe(error);
    });
  });
});
