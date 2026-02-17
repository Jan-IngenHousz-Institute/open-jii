import { faker } from "@faker-js/faker";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { Readable } from "stream";

import { AppError, success, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { DownloadExportUseCase } from "../application/use-cases/experiment-data/download-export";
import { InitiateExportUseCase } from "../application/use-cases/experiment-data/initiate-export";
import { ListExportsUseCase } from "../application/use-cases/experiment-data/list-exports";
import { ExperimentDataExportsController } from "./experiment-data-exports.controller";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataExportsController", () => {
  const testApp = TestHarness.App;
  let controller: ExperimentDataExportsController;
  let initiateExportUseCase: InitiateExportUseCase;
  let listExportsUseCase: ListExportsUseCase;
  let downloadExportUseCase: DownloadExportUseCase;

  const mockSession: UserSession = {
    user: {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      expiresAt: new Date(Date.now() + 86400000),
      token: faker.string.alphanumeric(32),
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    controller = testApp.module.get(ExperimentDataExportsController);
    initiateExportUseCase = testApp.module.get(InitiateExportUseCase);
    listExportsUseCase = testApp.module.get(ListExportsUseCase);
    downloadExportUseCase = testApp.module.get(DownloadExportUseCase);
    vi.restoreAllMocks();
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
      const exportId = faker.string.uuid();

      vi.spyOn(initiateExportUseCase, "execute").mockResolvedValue(
        success({ exportId, status: "pending" }),
      );

      const handler = controller.initiateExport(mockSession);
      const result = await handler({
        params: { id: experimentId },
        body: { tableName: "raw_data", format: "csv" },
        headers: {},
      });

      expect(result.status).toBe(201);
      expect(result.body).toEqual({ exportId, status: "pending" });
      expect(initiateExportUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        mockSession.user.id,
        { tableName: "raw_data", format: "csv" },
      );
    });

    it("should return 404 when experiment not found", async () => {
      const experimentId = faker.string.uuid();

      vi.spyOn(initiateExportUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      const handler = controller.initiateExport(mockSession);
      const result = await handler({
        params: { id: experimentId },
        body: { tableName: "raw_data", format: "csv" },
        headers: {},
      });

      expect(result.status).toBe(404);
    });

    it("should return 403 when access denied", async () => {
      const experimentId = faker.string.uuid();

      vi.spyOn(initiateExportUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Access denied")),
      );

      const handler = controller.initiateExport(mockSession);
      const result = await handler({
        params: { id: experimentId },
        body: { tableName: "raw_data", format: "csv" },
        headers: {},
      });

      expect(result.status).toBe(403);
    });
  });

  describe("listExports", () => {
    it("should return 200 with exports list", async () => {
      const experimentId = faker.string.uuid();
      const mockExports = {
        exports: [
          {
            exportId: faker.string.uuid(),
            experimentId,
            tableName: "raw_data",
            format: "csv" as const,
            status: "completed" as const,
            filePath: "/path/to/file.csv",
            rowCount: 500,
            fileSize: 25000,
            createdBy: mockSession.user.id,
            createdAt: "2026-01-01T00:00:00Z",
            completedAt: "2026-01-01T00:05:00Z",
            jobRunId: 123,
          },
        ],
      };

      vi.spyOn(listExportsUseCase, "execute").mockResolvedValue(success(mockExports));

      const handler = controller.listExports(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: { tableName: "raw_data" },
        headers: {},
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual(mockExports);
      expect(listExportsUseCase.execute).toHaveBeenCalledWith(experimentId, mockSession.user.id, {
        tableName: "raw_data",
      });
    });

    it("should return 404 when experiment not found", async () => {
      const experimentId = faker.string.uuid();

      vi.spyOn(listExportsUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      const handler = controller.listExports(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: { tableName: "raw_data" },
        headers: {},
      });

      expect(result.status).toBe(404);
    });

    it("should return 403 when access denied", async () => {
      const experimentId = faker.string.uuid();

      vi.spyOn(listExportsUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Access denied")),
      );

      const handler = controller.listExports(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: { tableName: "raw_data" },
        headers: {},
      });

      expect(result.status).toBe(403);
    });
  });

  describe("downloadExport", () => {
    it("should return 200 with StreamableFile on success", async () => {
      const experimentId = faker.string.uuid();
      const exportId = faker.string.uuid();
      const mockStream = new Readable({
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        read() {},
      });

      vi.spyOn(downloadExportUseCase, "execute").mockResolvedValue(
        success({ stream: mockStream, filename: "raw_data.csv" }),
      );

      const handler = controller.downloadExport(mockSession);
      const result = await handler({
        params: { id: experimentId, exportId },
        headers: {},
      });

      expect(result.status).toBe(200);
      // The body should be a StreamableFile
      expect(result.body).toBeDefined();
      expect(downloadExportUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        exportId,
        mockSession.user.id,
      );
    });

    it("should return 404 when export not found", async () => {
      const experimentId = faker.string.uuid();
      const exportId = faker.string.uuid();

      vi.spyOn(downloadExportUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Export not found")),
      );

      const handler = controller.downloadExport(mockSession);
      const result = await handler({
        params: { id: experimentId, exportId },
        headers: {},
      });

      expect(result.status).toBe(404);
    });

    it("should return 500 when download fails", async () => {
      const experimentId = faker.string.uuid();
      const exportId = faker.string.uuid();

      vi.spyOn(downloadExportUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Download failed")),
      );

      const handler = controller.downloadExport(mockSession);
      const result = await handler({
        params: { id: experimentId, exportId },
        headers: {},
      });

      expect(result.status).toBe(500);
    });
  });
});
