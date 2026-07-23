import { describe, expect, vi } from "vitest";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { ListUploadsUseCase } from "../application/use-cases/experiment-data-uploads/list-uploads";
import { UploadDataUseCase } from "../application/use-cases/experiment-data-uploads/upload-data";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataUploadsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let readableExperimentId: string;
  let uploadDataUseCase: UploadDataUseCase;
  let listUploadsUseCase: ListUploadsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Readable experiment",
      userId: testUserId,
    });
    readableExperimentId = experiment.id;
    uploadDataUseCase = testApp.module.get(UploadDataUseCase);
    listUploadsUseCase = testApp.module.get(ListUploadsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("uploadData (native streaming)", () => {
    it("streams to the use case and returns 201 with the upload result", async () => {
      const experimentId = readableExperimentId;
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

      const response = await testApp
        .post(`/api/v1/experiments/${experimentId}/data/uploads`)
        .withAuth(testUserId)
        .field("sourceKind", "csv")
        .field("targetKind", "new")
        .field("targetName", "leaf_traits")
        .attach("files", Buffer.from("a,b\n1,2\n"), "data.csv")
        .expect(201);

      expect(response.body).toEqual({
        uploadId: "u-2",
        uploadTableId: "33333333-3333-3333-3333-333333333333",
        uploadTableName: "leaf_traits",
        runId: 42,
        files,
      });
      const firstCall = vi.mocked(uploadDataUseCase.execute).mock.calls[0];
      expect(firstCall[0].experimentId).toBe(experimentId);
      expect(firstCall[0].fixedSourceKind).toBeUndefined();
    });

    it("omits uploadTableId/uploadTableName when the use case returns none", async () => {
      const experimentId = readableExperimentId;
      vi.spyOn(uploadDataUseCase, "execute").mockResolvedValue(
        success({ uploadId: "u-3", sourceKind: "csv", uploadTableName: undefined, files: [] }),
      );

      const response = await testApp
        .post(`/api/v1/experiments/${experimentId}/data/uploads`)
        .withAuth(testUserId)
        .field("sourceKind", "csv")
        .attach("files", Buffer.from("a,b\n1,2\n"), "data.csv")
        .expect(201);

      const body = response.body as { uploadTableId?: string; uploadTableName?: string };
      expect(body.uploadTableId).toBeUndefined();
      expect(body.uploadTableName).toBeUndefined();
    });

    it("returns 409 when the target table name is taken", async () => {
      const experimentId = readableExperimentId;
      vi.spyOn(uploadDataUseCase, "execute").mockResolvedValue(
        failure(AppError.conflict("A table named 'x' already exists", "UPLOAD_TABLE_NAME_TAKEN")),
      );

      await testApp
        .post(`/api/v1/experiments/${experimentId}/data/uploads`)
        .withAuth(testUserId)
        .field("sourceKind", "csv")
        .attach("files", Buffer.from("a,b\n1,2\n"), "data.csv")
        .expect(409);
    });

    it("returns 400 for a non-UUID experiment id", async () => {
      await testApp
        .post(`/api/v1/experiments/not-a-uuid/data/uploads`)
        .withAuth(testUserId)
        .field("sourceKind", "csv")
        .attach("files", Buffer.from("a,b\n1,2\n"), "data.csv")
        .expect(400);
    });
  });

  describe("listUploads (oRPC)", () => {
    it("forwards the optional uploadTableName filter to the use case", async () => {
      const experimentId = readableExperimentId;
      vi.spyOn(listUploadsUseCase, "execute").mockResolvedValue(success({ uploads: [] }));

      const response = await testApp
        .get(`/api/v1/experiments/${experimentId}/data/uploads?uploadTableName=leaf_traits`)
        .withAuth(testUserId)
        .expect(200);

      expect(response.body).toEqual({ uploads: [] });
      expect(listUploadsUseCase.execute).toHaveBeenCalledWith(
        experimentId,
        testUserId,
        expect.objectContaining({ uploadTableName: "leaf_traits" }),
      );
    });

    it("maps a not-found use case failure to 404", async () => {
      const experimentId = readableExperimentId;
      vi.spyOn(listUploadsUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      await testApp
        .get(`/api/v1/experiments/${experimentId}/data/uploads`)
        .withAuth(testUserId)
        .expect(404);
    });
  });

  describe("authorization", () => {
    it.each([
      {
        name: "upload data",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp.post(`/api/v1/experiments/${experimentId}/data/uploads`).withAuth(userId),
      },
      {
        name: "list uploads",
        action: "read",
        request: (experimentId: string, userId: string) =>
          testApp.get(`/api/v1/experiments/${experimentId}/data/uploads`).withAuth(userId),
      },
    ])("requires $action access to $name", async ({ action, request }) => {
      const unrelatedUserId = await testApp.createTestUser({});
      const canSpy = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      await request(readableExperimentId, unrelatedUserId).expect(403);

      expect(canSpy).toHaveBeenCalledTimes(1);
      expect(canSpy).toHaveBeenCalledWith(unrelatedUserId, {
        resourceType: "experiment",
        resourceId: readableExperimentId,
        action,
      });
    });
  });
});
