import { faker } from "@faker-js/faker";
import { expect } from "vitest";

import type {
  ExperimentExportDownloadLinksResponse,
  ExperimentExportRecord,
} from "@repo/api/domains/experiment/exports/experiment-exports.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, success, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { GetExportDownloadLinksUseCase } from "../application/use-cases/experiment-data-exports/get-export-download-links";
import { InitiateExportUseCase } from "../application/use-cases/experiment-data-exports/initiate-export";
import { ListExportsUseCase } from "../application/use-cases/experiment-data-exports/list-exports";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataExportsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let readableExperimentId: string;
  let initiateExportUseCase: InitiateExportUseCase;
  let listExportsUseCase: ListExportsUseCase;
  let getExportDownloadLinksUseCase: GetExportDownloadLinksUseCase;

  function exportRecord(overrides: Partial<ExperimentExportRecord> = {}): ExperimentExportRecord {
    return {
      exportId: faker.string.uuid(),
      experimentId: readableExperimentId,
      tableName: "raw_data",
      format: "csv",
      status: "completed",
      rowCount: 2500,
      totalBytes: 4_000_000_000,
      partCount: 4,
      errorCode: null,
      createdBy: testUserId,
      createdAt: "2026-07-18T09:55:01.123Z",
      completedAt: "2026-07-18T09:59:55.892Z",
      expiresAt: "2026-08-17T09:59:55.892Z",
      ...overrides,
    };
  }

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
    initiateExportUseCase = testApp.module.get(InitiateExportUseCase);
    listExportsUseCase = testApp.module.get(ListExportsUseCase);
    getExportDownloadLinksUseCase = testApp.module.get(GetExportDownloadLinksUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("initiateExport", () => {
    it("should return 201 with the recorded export", async () => {
      const record = exportRecord({ status: "queued", rowCount: null, totalBytes: null });
      vi.spyOn(initiateExportUseCase, "execute").mockResolvedValue(success(record));

      const response = await testApp
        .post(`/api/v1/experiments/${readableExperimentId}/data/exports`)
        .withAuth(testUserId)
        .send({ tableName: "raw_data", format: "csv" })
        .expect(201);

      expect(response.body).toEqual(record);
      expect(initiateExportUseCase.execute).toHaveBeenCalledWith(
        readableExperimentId,
        testUserId,
        expect.objectContaining({ tableName: "raw_data", format: "csv" }),
      );
    });

    it("should return 404 when experiment not found", async () => {
      vi.spyOn(initiateExportUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      await testApp
        .post(`/api/v1/experiments/${readableExperimentId}/data/exports`)
        .withAuth(testUserId)
        .send({ tableName: "raw_data", format: "csv" })
        .expect(404);
    });
  });

  describe("listExports", () => {
    it("should return 200 with the table's exports", async () => {
      const records = [exportRecord(), exportRecord({ status: "failed", errorCode: "no_data" })];
      vi.spyOn(listExportsUseCase, "execute").mockResolvedValue(success({ exports: records }));

      const response = await testApp
        .get(`/api/v1/experiments/${readableExperimentId}/data/exports?tableName=raw_data`)
        .withAuth(testUserId)
        .expect(200);

      expect(response.body).toEqual({ exports: records });
      expect(listExportsUseCase.execute).toHaveBeenCalledWith(readableExperimentId, testUserId, {
        tableName: "raw_data",
      });
    });

    it("should return 404 when experiment not found", async () => {
      vi.spyOn(listExportsUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Experiment not found")),
      );

      await testApp
        .get(`/api/v1/experiments/${readableExperimentId}/data/exports?tableName=raw_data`)
        .withAuth(testUserId)
        .expect(404);
    });
  });

  describe("getExportDownloadLinks", () => {
    const linksPath = (exportId: string) =>
      `/api/v1/experiments/${readableExperimentId}/data/exports/${exportId}/links`;

    it("should return 200 with one signed link per part", async () => {
      const exportId = faker.string.uuid();
      const links: ExperimentExportDownloadLinksResponse = {
        parts: [
          {
            index: 0,
            fileName: "readable-experiment_raw-data_20260718_095955.csv.gz",
            sizeBytes: 900,
            url: "https://bucket.s3.amazonaws.com/part-00000.csv.gz?X-Amz-Signature=abc",
          },
        ],
        expiresAt: "2026-07-18T10:14:55.000Z",
      };
      vi.spyOn(getExportDownloadLinksUseCase, "execute").mockResolvedValue(success(links));

      const response = await testApp.get(linksPath(exportId)).withAuth(testUserId).expect(200);

      expect(response.body).toEqual(links);
      expect(getExportDownloadLinksUseCase.execute).toHaveBeenCalledWith(
        readableExperimentId,
        exportId,
      );
    });

    it("should return 404 for an expired export", async () => {
      vi.spyOn(getExportDownloadLinksUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("This export has expired", "EXPORT_EXPIRED")),
      );

      await testApp.get(linksPath(faker.string.uuid())).withAuth(testUserId).expect(404);
    });

    it("should return 400 for an export that has not finished", async () => {
      vi.spyOn(getExportDownloadLinksUseCase, "execute").mockResolvedValue(
        failure(AppError.badRequest("This export is not ready to download", "EXPORT_NOT_READY")),
      );

      await testApp.get(linksPath(faker.string.uuid())).withAuth(testUserId).expect(400);
    });

    it("should return 400 for an export id that is not a UUID", async () => {
      const executeSpy = vi.spyOn(getExportDownloadLinksUseCase, "execute");

      await testApp.get(linksPath("not-a-uuid")).withAuth(testUserId).expect(400);

      expect(executeSpy).not.toHaveBeenCalled();
    });
  });

  describe("authorization", () => {
    it.each([
      {
        name: "initiate export",
        request: (experimentId: string, userId: string) =>
          testApp
            .post(`/api/v1/experiments/${experimentId}/data/exports`)
            .withAuth(userId)
            .send({ tableName: "raw_data", format: "csv" }),
      },
      {
        name: "list exports",
        request: (experimentId: string, userId: string) =>
          testApp.get(`/api/v1/experiments/${experimentId}/data/exports`).withAuth(userId),
      },
      {
        name: "download links",
        request: (experimentId: string, userId: string) =>
          testApp
            .get(`/api/v1/experiments/${experimentId}/data/exports/${faker.string.uuid()}/links`)
            .withAuth(userId),
      },
    ])("requires read access to $name", async ({ request }) => {
      const unrelatedUserId = await testApp.createTestUser({});
      const canSpy = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      await request(readableExperimentId, unrelatedUserId).expect(403);

      expect(canSpy).toHaveBeenCalledTimes(1);
      expect(canSpy).toHaveBeenCalledWith(unrelatedUserId, {
        resourceType: "experiment",
        resourceId: readableExperimentId,
        action: "read",
      });
    });
  });
});
