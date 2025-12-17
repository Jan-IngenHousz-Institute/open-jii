import { StatusCodes } from "http-status-codes";

import type { CreateTransferRequestBody, TransferRequest } from "@repo/api";
import { contract } from "@repo/api";

import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { CreateTransferRequestUseCase } from "../application/use-cases/project-transfer-requests/create-transfer-request/create-transfer-request";
import { ListTransferRequestsUseCase } from "../application/use-cases/project-transfer-requests/list-transfer-requests/list-transfer-requests";

describe("ProjectTransferRequestsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let createTransferRequestUseCase: CreateTransferRequestUseCase;
  let listTransferRequestsUseCase: ListTransferRequestsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    createTransferRequestUseCase = testApp.module.get(CreateTransferRequestUseCase);
    listTransferRequestsUseCase = testApp.module.get(ListTransferRequestsUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createTransferRequest", () => {
    it("should create a transfer request", async () => {
      const mockRequestId = "9f244bae-22d7-48c1-9459-b02a6846cea8";
      const mockUserEmail = "test@example.com";

      vi.spyOn(createTransferRequestUseCase, "execute").mockResolvedValue(
        success({
          requestId: mockRequestId,
          userId: testUserId,
          userEmail: mockUserEmail,
          sourcePlatform: "PhotosynQ",
          projectIdOld: "12345",
          projectUrlOld: "https://photosynq.org/projects/12345",
          status: "pending",
          requestedAt: new Date("2024-01-15T10:30:00.000Z"),
        }),
      );

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.createTransferRequest.path, {});

      // Create the request body
      const createRequestData: CreateTransferRequestBody = {
        projectIdOld: "12345",
        projectUrlOld: "https://photosynq.org/projects/12345",
      };

      // Send the request
      const response: SuperTestResponse<TransferRequest> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(createRequestData)
        .expect(StatusCodes.CREATED);

      expect(response.body.requestId).toBe(mockRequestId);
      expect(response.body.userId).toBe(testUserId);
      expect(response.body.projectIdOld).toBe("12345");
      expect(response.body.status).toBe("pending");
    });

    it("should return 400 if projectIdOld is missing", async () => {
      // Construct the path
      const path = testApp.resolvePath(contract.experiments.createTransferRequest.path, {});

      // Create the request body
      const createRequestData = {
        projectUrlOld: "https://photosynq.org/projects/12345",
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(createRequestData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if projectUrlOld is missing", async () => {
      // Construct the path
      const path = testApp.resolvePath(contract.experiments.createTransferRequest.path, {});

      // Create the request body
      const createRequestData = {
        projectIdOld: "12345",
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(createRequestData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if projectUrlOld is not a valid URL", async () => {
      // Construct the path
      const path = testApp.resolvePath(contract.experiments.createTransferRequest.path, {});

      // Create the request body
      const createRequestData = {
        projectIdOld: "12345",
        projectUrlOld: "not-a-url",
      };

      // Send the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(createRequestData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 when not authenticated", async () => {
      // Construct the path
      const path = testApp.resolvePath(contract.experiments.createTransferRequest.path, {});

      // Create the request body
      const createRequestData: CreateTransferRequestBody = {
        projectIdOld: "12345",
        projectUrlOld: "https://photosynq.org/projects/12345",
      };

      // Send the request
      await testApp
        .post(path)
        .withoutAuth()
        .send(createRequestData)
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listTransferRequests", () => {
    it("should list transfer requests for the authenticated user", async () => {
      const mockRequestId = "9f244bae-22d7-48c1-9459-b02a6846cea8";
      const mockUserEmail = "test@example.com";

      vi.spyOn(listTransferRequestsUseCase, "execute").mockResolvedValue(
        success([
          {
            requestId: mockRequestId,
            userId: testUserId,
            userEmail: mockUserEmail,
            sourcePlatform: "PhotosynQ",
            projectIdOld: "12345",
            projectUrlOld: "https://photosynq.org/projects/12345",
            status: "pending",
            requestedAt: new Date("2024-01-15T10:30:00.000Z"),
          },
          {
            requestId: "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789",
            userId: testUserId,
            userEmail: mockUserEmail,
            sourcePlatform: "PhotosynQ",
            projectIdOld: "67890",
            projectUrlOld: "https://photosynq.org/projects/67890",
            status: "completed",
            requestedAt: new Date("2024-01-14T09:20:00.000Z"),
          },
        ]),
      );

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.listTransferRequests.path, {});

      // Send the request
      const response: SuperTestResponse<TransferRequest[]> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].requestId).toBe(mockRequestId);
      expect(response.body[0].userId).toBe(testUserId);
      expect(response.body[0].status).toBe("pending");
      expect(response.body[1].status).toBe("completed");
    });

    it("should return empty array when user has no transfer requests", async () => {
      vi.spyOn(listTransferRequestsUseCase, "execute").mockResolvedValue(success([]));

      // Construct the path
      const path = testApp.resolvePath(contract.experiments.listTransferRequests.path, {});

      // Send the request
      const response: SuperTestResponse<TransferRequest[]> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(0);
    });

    it("should return 401 when not authenticated", async () => {
      // Construct the path
      const path = testApp.resolvePath(contract.experiments.listTransferRequests.path, {});

      // Send the request
      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
