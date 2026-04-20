import { faker } from "@faker-js/faker";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import { PassThrough } from "stream";
import { expect } from "vitest";

import { AppError, success, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data/get-experiment-data";
import { GetExperimentTablesUseCase } from "../application/use-cases/experiment-data/get-experiment-tables";
import { UploadAmbyteDataUseCase } from "../application/use-cases/experiment-data/upload-ambyte-data";
import type { ExperimentDto } from "../core/models/experiment.model";
import { ExperimentDataController } from "./experiment-data.controller";

/* eslint-disable @typescript-eslint/unbound-method */

/**
 * Build a real multipart/form-data request stream.
 * Because we use real busboy (no vi.mock), execute mocks must drain
 * `fileData.stream` (via `.resume()`) or busboy will never emit 'close'.
 */
function multipartRequest(
  parts: (
    | { field: string; value: string }
    | { name: string; filename: string; content: string; mime: string }
  )[],
): Request {
  const boundary = "----TestBoundary";
  const body = parts
    .map((p) =>
      "field" in p
        ? `--${boundary}\r\nContent-Disposition: form-data; name="${p.field}"\r\n\r\n${p.value}\r\n`
        : `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\nContent-Type: ${p.mime}\r\n\r\n${p.content}\r\n`,
    )
    .concat(`--${boundary}--\r\n`)
    .join("");

  const stream = new PassThrough();
  stream.end(Buffer.from(body));
  return Object.assign(stream, {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  }) as unknown as Request;
}

describe("ExperimentDataController", () => {
  const testApp = TestHarness.App;
  let controller: ExperimentDataController;
  let getExperimentDataUseCase: GetExperimentDataUseCase;
  let getExperimentTablesUseCase: GetExperimentTablesUseCase;
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
    uploadAmbyteDataUseCase = testApp.module.get(UploadAmbyteDataUseCase);
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

    it("should return 403 if user doesn't have access to the experiment", async () => {
      const experimentId = faker.string.uuid();
      const error = AppError.forbidden("Access denied to this experiment");

      vi.spyOn(getExperimentDataUseCase, "execute").mockResolvedValue(failure(error));

      const handler = controller.getExperimentData(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: { tableName: "test_table", page: 1, pageSize: 5 },
        headers: {},
      });

      expect(result.status).toBe(403);
    });

    it("should return 400 for invalid experiment UUID", async () => {
      const invalidId = "not-a-uuid";
      const error = AppError.badRequest("Invalid experiment ID");

      vi.spyOn(getExperimentDataUseCase, "execute").mockResolvedValue(failure(error));

      const handler = controller.getExperimentData(mockSession);
      const result = await handler({
        params: { id: invalidId },
        query: { tableName: "test_table" },
        headers: {},
      });

      expect(result.status).toBe(400);
    });
  });

  describe("uploadExperimentData", () => {
    const experimentId = faker.string.uuid();
    const mockExperiment = { id: experimentId, name: "test-exp" } as unknown as ExperimentDto;

    // Invoke the upload handler
    const upload = async (req: Request, id = experimentId) => {
      const handler = controller.uploadExperimentData(mockSession, req);
      return handler({ params: { id }, body: {} as never, headers: {} });
    };

    // Execute mock that drains the file stream so busboy can finish
    const drainExecute = (fileData: { stream?: { resume?: () => void } }) => {
      fileData.stream?.resume?.();
    };

    // Minimal request for tests where preexecute fails before busboy runs
    const stubRequest = {
      headers: { "content-type": "multipart/form-data; boundary=x" },
    } as unknown as Request;

    it("should process file upload successfully", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        success({ experiment: mockExperiment, directoryName: "dir" }),
      );
      vi.spyOn(uploadAmbyteDataUseCase, "execute").mockImplementation(drainExecute);
      vi.spyOn(uploadAmbyteDataUseCase, "postexecute").mockResolvedValue(
        success({ uploadId: "123", files: [{ fileName: "test.csv", filePath: "path" }] }),
      );

      const result = await upload(
        multipartRequest([
          { field: "sourceType", value: "ambyte" },
          { name: "files", filename: "test.csv", content: "col1,col2\n1,2", mime: "text/csv" },
        ]),
      );

      expect(result.status).toBe(201);
      expect(uploadAmbyteDataUseCase.execute).toHaveBeenCalled();
    });

    it("should return 400 if not multipart", async () => {
      const result = await upload({
        headers: { "content-type": "application/json" },
      } as unknown as Request);

      expect(result.status).toBe(400);
    });

    it("should return 404 when experiment does not exist", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      const result = await upload(stubRequest, faker.string.uuid());
      expect(result.status).toBe(404);
    });

    it("should return 403 when user does not have access", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        failure(AppError.forbidden("User does not have access to experiment")),
      );

      const result = await upload(stubRequest);
      expect(result.status).toBe(403);
    });

    it("should return 403 when uploading to an archived experiment", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        failure(AppError.forbidden("Cannot upload data to archived experiments")),
      );

      const result = await upload(stubRequest);
      expect(result.status).toBe(403);
      expect((result.body as { message: string }).message).toBe(
        "Cannot upload data to archived experiments",
      );
    });

    it("should return 400 when no files are uploaded", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        success({ experiment: mockExperiment, directoryName: "dir" }),
      );
      vi.spyOn(uploadAmbyteDataUseCase, "execute").mockResolvedValue(undefined);
      vi.spyOn(uploadAmbyteDataUseCase, "postexecute").mockResolvedValue(
        failure(AppError.badRequest("No files were uploaded")),
      );

      const result = await upload(multipartRequest([{ field: "sourceType", value: "ambyte" }]));
      expect(result.status).toBe(400);
    });

    it("should reject invalid file formats", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        success({ experiment: mockExperiment, directoryName: "dir" }),
      );
      vi.spyOn(uploadAmbyteDataUseCase, "execute").mockImplementation(drainExecute);
      vi.spyOn(uploadAmbyteDataUseCase, "postexecute").mockResolvedValue(
        failure(AppError.badRequest("Invalid file format: only .txt files are allowed")),
      );

      const result = await upload(
        multipartRequest([
          { field: "sourceType", value: "ambyte" },
          { name: "files", filename: "invalid.pdf", content: "pdf", mime: "application/pdf" },
        ]),
      );
      expect(result.status).toBe(400);
    });

    it("should fail if sourceType is missing before file", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        success({ experiment: mockExperiment, directoryName: "dir" }),
      );
      vi.spyOn(uploadAmbyteDataUseCase, "execute").mockImplementation(drainExecute);
      vi.spyOn(uploadAmbyteDataUseCase, "postexecute").mockResolvedValue(
        success({ uploadId: "123", files: [] }),
      );

      const result = await upload(
        multipartRequest([
          { name: "files", filename: "test.csv", content: "data", mime: "text/csv" },
        ]),
      );
      expect(result.status).toBe(400);
      expect((result.body as { message: string }).message).toContain(
        "sourceType field must be provided",
      );
    });

    it("should skip files with wrong fieldname", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        success({ experiment: mockExperiment, directoryName: "dir" }),
      );
      vi.spyOn(uploadAmbyteDataUseCase, "execute").mockImplementation(drainExecute);
      vi.spyOn(uploadAmbyteDataUseCase, "postexecute").mockResolvedValue(
        success({ uploadId: "123", files: [] }),
      );

      const result = await upload(
        multipartRequest([
          { field: "sourceType", value: "ambyte" },
          { name: "wrong_field", filename: "test.csv", content: "data", mime: "text/csv" },
        ]),
      );
      expect(result.status).toBe(201);
      expect(uploadAmbyteDataUseCase.execute).not.toHaveBeenCalled();
    });

    it("should handle busboy error", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        success({ experiment: mockExperiment, directoryName: "dir" }),
      );

      // Missing boundary causes busboy to throw during construction
      const result = await upload({
        headers: { "content-type": "multipart/form-data" },
        pipe: vi.fn(),
      } as unknown as Request);

      expect(result.status).toBe(500);
    });

    it("should capture execute errors in processing queue", async () => {
      vi.spyOn(uploadAmbyteDataUseCase, "preexecute").mockResolvedValue(
        success({ experiment: mockExperiment, directoryName: "dir" }),
      );
      vi.spyOn(uploadAmbyteDataUseCase, "execute").mockImplementation(
        (fileData: { stream?: { resume?: () => void } }): Promise<never> => {
          fileData.stream?.resume?.();
          return Promise.reject(new Error("Upload failed"));
        },
      );
      vi.spyOn(uploadAmbyteDataUseCase, "postexecute").mockResolvedValue(
        success({ uploadId: "123", files: [] }),
      );

      const result = await upload(
        multipartRequest([
          { field: "sourceType", value: "ambyte" },
          { name: "files", filename: "test.csv", content: "data", mime: "text/csv" },
        ]),
      );

      expect(result.status).toBe(201);
    });
  });
});
