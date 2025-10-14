import { StatusCodes } from "http-status-codes";

import type { ExperimentDataComment } from "@repo/api";
import { contract } from "@repo/api";

import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CreateExperimentDataCommentsUseCase } from "../application/use-cases/experiment-data-comments/create-experiment-data-comments";

describe("ExperimentCommentsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let createUseCase: CreateExperimentDataCommentsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    createUseCase = testApp.module.get(CreateExperimentDataCommentsUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createExperimentDataComments", () => {
    it("should create comments successfully", async () => {
      const mockComments: ExperimentDataComment[] = [
        {
          rowId: "1",
          text: "Test comment",
          createdAt: new Date().toISOString(),
          createdBy: testUserId,
        },
        {
          rowId: "2",
          text: "Another comment",
          createdAt: new Date().toISOString(),
          createdBy: testUserId,
        },
      ];

      vi.spyOn(createUseCase, "execute").mockResolvedValue(success(mockComments));

      const path = testApp.resolvePath(contract.experiments.createExperimentDataComments.path, {
        id: "74254b9f-c558-48d3-b20b-73e87ae256ca",
        tableName: "test-table",
      });
      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ rowIds: ["e442d227-b540-4cc9-b684-8b01c515640a"], text: "test body" })
        .expect(StatusCodes.CREATED);

      expect(response.body).toStrictEqual(mockComments);
    });

    it("should return 400 if text is missing", async () => {
      const path = testApp.resolvePath(contract.experiments.createExperimentDataComments.path, {
        id: "74254b9f-c558-48d3-b20b-73e87ae256ca",
        tableName: "test-table",
      });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ rowIds: ["e442d227-b540-4cc9-b684-8b01c515640a"] })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolvePath(contract.experiments.createExperimentDataComments.path, {
        id: "74254b9f-c558-48d3-b20b-73e87ae256ca",
        tableName: "test-table",
      });
      await testApp
        .post(path)
        .withoutAuth()
        .send({ rowIds: ["e442d227-b540-4cc9-b684-8b01c515640a"], text: "test body" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("deleteExperimentDataComments", () => {
    it("should delete multiple comments successfully", async () => {
      const path = testApp.resolvePath(contract.experiments.deleteExperimentDataComments.path, {
        id: "74254b9f-c558-48d3-b20b-73e87ae256ca",
        tableName: "test-table",
      });
      await testApp
        .put(path)
        .withAuth(testUserId)
        .send({
          rowIds: ["e442d227-b540-4cc9-b684-8b01c515640a", "18fde982-6a8e-4dae-ae7b-4d4ca7b957bc"],
          type: "comment",
        })
        .expect(StatusCodes.NO_CONTENT);
    });

    it("should delete specific comment successfully", async () => {
      const path = testApp.resolvePath(contract.experiments.deleteExperimentDataComments.path, {
        id: "74254b9f-c558-48d3-b20b-73e87ae256ca",
        tableName: "test-table",
      });
      await testApp
        .put(path)
        .withAuth(testUserId)
        .send({
          rowId: "e442d227-b540-4cc9-b684-8b01c515640a",
          createdBy: "447af79d-a956-4452-bc6a-fbd77da6cc31",
          createdAt: new Date().toISOString(),
        })
        .expect(StatusCodes.NO_CONTENT);
    });

    it("should return 400 if request is incorrect", async () => {
      const path = testApp.resolvePath(contract.experiments.deleteExperimentDataComments.path, {
        id: "74254b9f-c558-48d3-b20b-73e87ae256ca",
        tableName: "test-table",
      });
      await testApp
        .put(path)
        .withAuth(testUserId)
        .send({ rowIds: ["e442d227-b540-4cc9-b684-8b01c515640a"] })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolvePath(contract.experiments.deleteExperimentDataComments.path, {
        id: "74254b9f-c558-48d3-b20b-73e87ae256ca",
        tableName: "test-table",
      });
      await testApp
        .put(path)
        .withoutAuth()
        .send({ rowIds: ["e442d227-b540-4cc9-b684-8b01c515640a"] })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
