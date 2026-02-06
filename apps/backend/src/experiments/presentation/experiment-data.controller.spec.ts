import { faker } from "@faker-js/faker";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import busboy from "busboy";
import type { Request } from "express";
import { expect } from "vitest";

import { AppError, success, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { DownloadExperimentDataUseCase } from "../application/use-cases/experiment-data/download-experiment-data";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data/get-experiment-data";
import { GetExperimentTablesUseCase } from "../application/use-cases/experiment-data/get-experiment-tables";
import { UploadAmbyteDataUseCase } from "../application/use-cases/experiment-data/upload-ambyte-data";
import type { ExperimentDto } from "../core/models/experiment.model";
import { ExperimentDataController } from "./experiment-data.controller";

vi.mock("busboy");

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataController", () => {
  const testApp = TestHarness.App;
  let controller: ExperimentDataController;
  let getExperimentDataUseCase: GetExperimentDataUseCase;
  let getExperimentTablesUseCase: GetExperimentTablesUseCase;
  let downloadExperimentDataUseCase: DownloadExperimentDataUseCase;
  let uploadAmbyteDataUseCase: UploadAmbyteDataUseCase;

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
    controller = testApp.module.get(ExperimentDataController);
    getExperimentDataUseCase = testApp.module.get(GetExperimentDataUseCase);
    getExperimentTablesUseCase = testApp.module.get(GetExperimentTablesUseCase);
    downloadExperimentDataUseCase = testApp.module.get(DownloadExperimentDataUseCase);
    uploadAmbyteDataUseCase = testApp.module.get(UploadAmbyteDataUseCase);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getExperimentTables", () => {
    it("should return tables metadata successfully", async () => {
      const experimentId = faker.string.uuid();
      const mockTables = [
        {
          name: "raw_data",
          displayName: "Raw Data",
          catalog_name: "centrum",
          schema_name: "centrum",
          full_name: "centrum.centrum.exp_123_raw_data",
          table_type: "MANAGED",
          data_source_format: "DELTA",
          totalRows: 1000,
          columns: [
            { name: "id", type_name: "string", type_text: "string", position: 0 },
            { name: "value", type_name: "int", type_text: "int", position: 1 },
          ],
        },
      ];

      vi.spyOn(getExperimentTablesUseCase, "execute").mockResolvedValue(success(mockTables));

      const handler = controller.getExperimentTables(mockSession);
      const result = await handler({ params: { id: experimentId }, headers: {} });

      expect(result.status).toBe(200);
      expect(result.body).toEqual(mockTables);
      expect(getExperimentTablesUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        mockSession.user.id,
      );
    });

    it("should handle use case failure", async () => {
      const experimentId = faker.string.uuid();
      const error = AppError.notFound("Experiment not found");

      vi.spyOn(getExperimentTablesUseCase, "execute").mockResolvedValue(failure(error));

      const handler = controller.getExperimentTables(mockSession);
      const result = await handler({ params: { id: experimentId }, headers: {} });

      expect(result.status).toBe(404);
    });
  });

  describe("getExperimentData", () => {
    it("should return experiment data successfully", async () => {
      const experimentId = faker.string.uuid();
      const mockData = [
        {
          name: "raw_data",
          catalog_name: "centrum",
          schema_name: "centrum",
          data: {
            columns: [
              { name: "id", type_name: "string", type_text: "string" },
              { name: "value", type_name: "int", type_text: "int" },
            ],
            rows: [
              { id: "1", value: "100" },
              { id: "2", value: "200" },
            ],
            totalRows: 2,
            truncated: false,
          },
          page: 1,
          pageSize: 10,
          totalRows: 2,
          totalPages: 1,
        },
      ];

      vi.spyOn(getExperimentDataUseCase, "execute").mockResolvedValue(success(mockData));

      const handler = controller.getExperimentData(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: {
          tableName: "raw_data",
          page: 1,
          pageSize: 10,
        },
        headers: {},
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual(mockData);
      expect(getExperimentDataUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        mockSession.user.id,
        {
          tableName: "raw_data",
          page: 1,
          pageSize: 10,
          columns: undefined,
          orderBy: undefined,
          orderDirection: undefined,
        },
      );
    });

    it("should handle use case failure", async () => {
      const experimentId = faker.string.uuid();
      const error = AppError.forbidden("Access denied");

      vi.spyOn(getExperimentDataUseCase, "execute").mockResolvedValue(failure(error));

      const handler = controller.getExperimentData(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: { tableName: "raw_data" },
        headers: {},
      });

      expect(result.status).toBe(403);
    });
  });

  describe("downloadExperimentData", () => {
    it("should return download links successfully", async () => {
      const experimentId = faker.string.uuid();
      const mockDownloadData = {
        externalLinks: [
          {
            externalLink: "https://databricks.com/chunk0",
            expiration: "2024-12-31T23:59:59Z",
            totalSize: 1048576,
            rowCount: 500,
          },
        ],
        totalRows: 500,
      };

      vi.spyOn(downloadExperimentDataUseCase, "execute").mockResolvedValue(
        success(mockDownloadData),
      );

      const handler = controller.downloadExperimentData(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: { tableName: "raw_data" },
        headers: {},
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual(mockDownloadData);
      expect(downloadExperimentDataUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        mockSession.user.id,
        { tableName: "raw_data" },
      );
    });

    it("should handle use case failure", async () => {
      const experimentId = faker.string.uuid();
      const error = AppError.internal("Download failed");

      vi.spyOn(downloadExperimentDataUseCase, "execute").mockResolvedValue(failure(error));

      const handler = controller.downloadExperimentData(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: { tableName: "raw_data" },
        headers: {},
      });

      expect(result.status).toBe(500);
    });
  });

  describe("uploadExperimentData", () => {
    const experimentId = faker.string.uuid();
    const mockExperiment = { id: experimentId, name: "test-exp" } as unknown as ExperimentDto;

    const setupMocks = () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        success({
          experiment: mockExperiment,
          directoryName: "dir",
        }),
      );
      vi.spyOn(uploadAmbyteDataUseCase, "execute").mockResolvedValue(undefined);
      vi.spyOn(uploadAmbyteDataUseCase, "postexecute").mockResolvedValue(
        success({ uploadId: "123", files: [{ fileName: "test.csv", filePath: "path" }] }),
      );
    };

    interface BusboyHandlers {
      field?: (name: string, value: string) => void;
      file?: (
        fieldname: string,
        file: { resume: () => void },
        info: { filename: string; encoding: string; mimeType: string },
      ) => void;
      close?: () => void;
      error?: (err: Error) => void;
    }

    const runTest = async (configureBusboy: (handlers: BusboyHandlers) => void) => {
      const busboyHandlers: Record<string, (...args: unknown[]) => void> = {};
      const mockBusboy = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          busboyHandlers[event] = handler;
          return mockBusboy;
        }),
      };
      (busboy as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockBusboy);

      const requestMock = {
        headers: { "content-type": "multipart/form-data; boundary=boundary" },
        pipe: vi.fn(() => {
          configureBusboy(busboyHandlers);
        }),
      } as unknown as Request;

      const handler = controller.uploadExperimentData(mockSession, requestMock);
      return await handler({
        params: { id: experimentId },
        body: {} as never,
        headers: {},
      });
    };

    it("should process file upload successfully", async () => {
      setupMocks();
      const result = await runTest((handlers) => {
        if (handlers.field) handlers.field("sourceType", "ambyte");
        if (handlers.file) {
          handlers.file(
            "files",
            { resume: vi.fn() },
            {
              filename: "test.csv",
              encoding: "7bit",
              mimeType: "text/csv",
            },
          );
        }
        if (handlers.close) handlers.close();
      });

      expect(result.status).toBe(201);
      expect(uploadAmbyteDataUseCase.execute).toHaveBeenCalled();
    });

    it("should return 400 if not multipart", async () => {
      const requestMock = {
        headers: { "content-type": "application/json" },
      } as unknown as Request;

      const handler = controller.uploadExperimentData(mockSession, requestMock);
      const result = await handler({
        params: { id: experimentId },
        body: {} as never,
        headers: {},
      });

      expect(result.status).toBe(400);
    });

    it("should fail if sourceType is missing before file", async () => {
      setupMocks();
      const result = await runTest((handlers) => {
        // No field handler called
        if (handlers.file) {
          handlers.file(
            "files",
            { resume: vi.fn() },
            {
              filename: "test.csv",
              encoding: "7bit",
              mimeType: "text/csv",
            },
          );
        }
        if (handlers.close) handlers.close();
      });

      expect(result.status).toBe(400);
      expect((result.body as { message: string }).message).toContain(
        "sourceType field must be provided",
      );
    });

    it("should skip files with wrong fieldname", async () => {
      setupMocks();
      const resumeSpy = vi.fn();
      const result = await runTest((handlers) => {
        if (handlers.field) handlers.field("sourceType", "ambyte");
        if (handlers.file) {
          // Wrong fieldname
          handlers.file(
            "wrong_field",
            { resume: resumeSpy },
            {
              filename: "test.csv",
              encoding: "7bit",
              mimeType: "text/csv",
            },
          );
        }
        if (handlers.close) handlers.close();
      });

      expect(result.status).toBe(201); // Success but nothing uploaded
      expect(resumeSpy).toHaveBeenCalled();
      expect(uploadAmbyteDataUseCase.execute).not.toHaveBeenCalled();
    });

    it("should handle busboy error", async () => {
      setupMocks();
      const result = await runTest((handlers) => {
        if (handlers.error) handlers.error(new Error("Busboy stream error"));
      });

      expect(result.status).toBe(500);
    });

    it("should capture execute errors in processing queue", async () => {
      setupMocks();
      // Mock execute failure
      vi.spyOn(uploadAmbyteDataUseCase, "execute").mockRejectedValue(new Error("Upload failed"));

      const result = await runTest((handlers) => {
        if (handlers.field) handlers.field("sourceType", "ambyte");
        if (handlers.file) {
          handlers.file(
            "files",
            { resume: vi.fn() },
            {
              filename: "test.csv",
              encoding: "7bit",
              mimeType: "text/csv",
            },
          );
        }
        if (handlers.close) handlers.close();
      });

      expect(uploadAmbyteDataUseCase.execute).toHaveBeenCalled();
      expect(result.status).toBe(201);
    });
  });
});
