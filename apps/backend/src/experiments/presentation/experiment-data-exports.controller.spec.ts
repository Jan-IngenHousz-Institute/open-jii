import { faker } from "@faker-js/faker";
import { Readable } from "stream";
import { expect } from "vitest";

import { AppError, success, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { DownloadExportUseCase } from "../application/use-cases/experiment-data-exports/download-export";
import { InitiateExportUseCase } from "../application/use-cases/experiment-data-exports/initiate-export";
import { ListExportsUseCase } from "../application/use-cases/experiment-data-exports/list-exports";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataExportsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let initiateExportUseCase: InitiateExportUseCase;
  let listExportsUseCase: ListExportsUseCase;
  let downloadExportUseCase: DownloadExportUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    initiateExportUseCase = testApp.module.get(InitiateExportUseCase);
    listExportsUseCase = testApp.module.get(ListExportsUseCase);
    downloadExportUseCase = testApp.module.get(DownloadExportUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("initiateExport", () => {
    it("should return 201 when export is initiated successfully", async () => {
      const experimentId = faker.string.uuid();

      vi.spyOn(initiateExportUseCase, "execute").mockResolvedValue(success({ status: "pending" }));

      const response = await testApp
        .post(`/api/v1/experiments/${experimentId}/data/exports`)
        .withAuth(testUserId)
        .send({ tableName: "raw_data", format: "csv" })
        .expect(201);

      expect(response.body).toEqual({ status: "pending" });
      expect(initiateExportUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        testUserId,
        expect.objectContaining({ tableName: "raw_data", format: "csv" }),
      );
    });

    it("should return 404 when experiment not found", async () => {
      const experimentId = faker.string.uuid();
      vi.spyOn(initiateExportUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      await testApp
        .post(`/api/v1/experiments/${experimentId}/data/exports`)
        .withAuth(testUserId)
        .send({ tableName: "raw_data", format: "csv" })
        .expect(404);
    });

    it("should return 403 when access denied", async () => {
      const experimentId = faker.string.uuid();
      vi.spyOn(initiateExportUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Access denied")),
      );

      await testApp
        .post(`/api/v1/experiments/${experimentId}/data/exports`)
        .withAuth(testUserId)
        .send({ tableName: "raw_data", format: "csv" })
        .expect(403);
    });
  });

  describe("listExports", () => {
    it("should return 200 with exports list, stripping fields outside the contract", async () => {
      const experimentId = faker.string.uuid();
      const exportRecord = {
        exportId: faker.string.uuid(),
        experimentId,
        tableName: "raw_data",
        format: "csv" as const,
        status: "completed" as const,
        filePath: "/path/to/file.csv",
        rowCount: 2500,
        fileSize: 1048576,
        createdBy: testUserId,
        createdAt: "2026-07-18T09:55:01.123456Z",
        completedAt: "2026-07-18T09:59:55.892636Z",
      };

      vi.spyOn(listExportsUseCase, "execute").mockResolvedValue(
        success({ exports: [{ ...exportRecord, jobRunId: 123 }] }),
      );

      const response = await testApp
        .get(`/api/v1/experiments/${experimentId}/data/exports?tableName=raw_data`)
        .withAuth(testUserId)
        .expect(200);

      expect(response.body).toEqual({ exports: [exportRecord] });
      expect(listExportsUseCase.execute).toHaveBeenCalledWith(experimentId, testUserId, {
        tableName: "raw_data",
      });
    });

    it("should return 404 when experiment not found", async () => {
      const experimentId = faker.string.uuid();
      vi.spyOn(listExportsUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/data/exports?tableName=raw_data`)
        .withAuth(testUserId)
        .expect(404);
    });

    it("should return 403 when access denied", async () => {
      const experimentId = faker.string.uuid();
      vi.spyOn(listExportsUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Access denied")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/data/exports?tableName=raw_data`)
        .withAuth(testUserId)
        .expect(403);
    });
  });

  describe("downloadExport", () => {
    it("should return 200 streaming the export file", async () => {
      const experimentId = faker.string.uuid();
      const exportId = faker.string.uuid();
      const fileContents = "col1,col2\n1,2\n";

      vi.spyOn(downloadExportUseCase, "execute").mockResolvedValue(
        success({ stream: Readable.from([Buffer.from(fileContents)]), filename: "raw_data.csv" }),
      );

      const response = await testApp
        .get(`/api/v1/experiments/${experimentId}/data/exports/${exportId}`)
        .withAuth(testUserId)
        .expect(200);

      expect(response.headers["content-disposition"]).toContain("raw_data.csv");
      expect(downloadExportUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        exportId,
        testUserId,
      );
    });

    it("should return 404 when export not found", async () => {
      const experimentId = faker.string.uuid();
      const exportId = faker.string.uuid();
      vi.spyOn(downloadExportUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Export not found")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/data/exports/${exportId}`)
        .withAuth(testUserId)
        .expect(404);
    });

    it("should return 500 when download fails", async () => {
      const experimentId = faker.string.uuid();
      const exportId = faker.string.uuid();
      vi.spyOn(downloadExportUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Download failed")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/data/exports/${exportId}`)
        .withAuth(testUserId)
        .expect(500);
    });
  });
});
