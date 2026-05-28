import { faker } from "@faker-js/faker";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import { describe, expect, vi } from "vitest";

import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { ListUploadsUseCase } from "../application/use-cases/experiment-data-uploads/list-uploads";
import { UploadDataUseCase } from "../application/use-cases/experiment-data-uploads/upload-data";
import { ExperimentDataUploadsController } from "./experiment-data-uploads.controller";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataUploadsController", () => {
  const testApp = TestHarness.App;
  let controller: ExperimentDataUploadsController;
  let uploadDataUseCase: UploadDataUseCase;
  let listUploadsUseCase: ListUploadsUseCase;

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

  // The controller passes request straight to the use case; spied use cases
  // ignore its content, so a minimal stub suffices.
  const stubRequest = {
    headers: { "content-type": "multipart/form-data; boundary=x" },
  } as unknown as Request;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    controller = testApp.module.get(ExperimentDataUploadsController);
    uploadDataUseCase = testApp.module.get(UploadDataUseCase);
    listUploadsUseCase = testApp.module.get(ListUploadsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("uploadData", () => {
    it("invokes the use case without a fixed source kind and returns 201", async () => {
      const experimentId = faker.string.uuid();
      const files = [{ fileName: "data.csv", filePath: "/Volumes/x/y" }];
      vi.spyOn(uploadDataUseCase, "execute").mockResolvedValue(
        success({
          uploadId: "u-2",
          sourceKind: "csv",
          uploadTableId: "33333333-3333-3333-3333-333333333333",
          uploadTableName: "leaf_traits",
          runId: 42,
          files,
        }),
      );

      const handler = controller.uploadData(mockSession, stubRequest);
      const result = await handler({
        params: { id: experimentId },
        body: {} as never,
        headers: {},
      });

      expect(result.status).toBe(201);
      expect(result.body).toEqual({
        uploadId: "u-2",
        uploadTableId: "33333333-3333-3333-3333-333333333333",
        uploadTableName: "leaf_traits",
        runId: 42,
        files,
      });
      const firstCall = vi.mocked(uploadDataUseCase.execute).mock.calls[0];
      expect(firstCall[0].fixedSourceKind).toBeUndefined();
    });

    it("propagates undefined uploadTableId/uploadTableName when the use case returns none", async () => {
      vi.spyOn(uploadDataUseCase, "execute").mockResolvedValue(
        success({
          uploadId: "u-3",
          sourceKind: "csv",
          uploadTableName: undefined,
          files: [],
        }),
      );

      const handler = controller.uploadData(mockSession, stubRequest);
      const result = await handler({
        params: { id: faker.string.uuid() },
        body: {} as never,
        headers: {},
      });

      expect(result.status).toBe(201);
      const body = result.body as { uploadTableId?: string; uploadTableName?: string };
      expect(body.uploadTableId).toBeUndefined();
      expect(body.uploadTableName).toBeUndefined();
    });

    it("returns 409 when the target table name is taken", async () => {
      vi.spyOn(uploadDataUseCase, "execute").mockResolvedValue(
        failure(AppError.conflict("A table named 'x' already exists", "UPLOAD_TABLE_NAME_TAKEN")),
      );

      const handler = controller.uploadData(mockSession, stubRequest);
      const result = await handler({
        params: { id: faker.string.uuid() },
        body: {} as never,
        headers: {},
      });

      expect(result.status).toBe(409);
    });
  });

  describe("listUploads", () => {
    it("forwards optional uploadTableName filter to the use case", async () => {
      const experimentId = faker.string.uuid();
      vi.spyOn(listUploadsUseCase, "execute").mockResolvedValue(success({ uploads: [] }));

      const handler = controller.listUploads(mockSession);
      const result = await handler({
        params: { id: experimentId },
        query: { uploadTableName: "leaf_traits" },
        headers: {},
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ uploads: [] });
      expect(listUploadsUseCase.execute).toHaveBeenCalledWith(experimentId, mockSession.user.id, {
        uploadTableName: "leaf_traits",
      });
    });

    it("maps a not-found use case failure to 404", async () => {
      vi.spyOn(listUploadsUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      const handler = controller.listUploads(mockSession);
      const result = await handler({
        params: { id: faker.string.uuid() },
        query: {},
        headers: {},
      });

      expect(result.status).toBe(404);
    });
  });
});
