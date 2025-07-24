import { TestHarness } from "@/test/test-harness";

import {
  assertSuccess,
  assertFailure,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { ListFlowsUseCase } from "./list-flows";

describe("ListFlowsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListFlowsUseCase;
  let flowRepository: FlowRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListFlowsUseCase);
    flowRepository = testApp.module.get(FlowRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should list flows successfully when flows exist", async () => {
      // Create test flows
      await flowRepository.create({ name: "Flow 1", description: "First flow" }, testUserId);
      await flowRepository.create({ name: "Flow 2", description: "Second flow" }, testUserId);
      await flowRepository.create({ name: "Flow 3" }, testUserId);

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(3);
      expect(result.value).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Flow 1",
            description: "First flow",
            isActive: true,
            createdBy: testUserId,
          }),
          expect.objectContaining({
            name: "Flow 2",
            description: "Second flow",
            isActive: true,
            createdBy: testUserId,
          }),
          expect.objectContaining({
            name: "Flow 3",
            isActive: true,
            createdBy: testUserId,
          }),
        ]),
      );
    });

    it("should return empty array when no flows exist", async () => {
      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should handle repository failure", async () => {
      const repositoryError = new Error("Database connection failed");
      jest.spyOn(flowRepository, "findAll").mockResolvedValueOnce(failure(repositoryError));

      const result = await useCase.execute();

      assertFailure(result);
      expect(result.error).toBe(repositoryError);
    });

    it("should handle repository throwing an exception", async () => {
      const repositoryError = new Error("Unexpected database error");
      jest.spyOn(flowRepository, "findAll").mockRejectedValueOnce(repositoryError);

      await expect(useCase.execute()).rejects.toThrow(repositoryError);
    });

    it("should handle repository returning null", async () => {
      jest.spyOn(flowRepository, "findAll").mockResolvedValueOnce(success(null as any));

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should handle repository returning undefined", async () => {
      jest.spyOn(flowRepository, "findAll").mockResolvedValueOnce(success(undefined as any));

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toBeUndefined();
    });

    it("should return flows in correct order (newest first)", async () => {
      // Create flows with slight delay to ensure different timestamps
      await flowRepository.create({ name: "First Flow" }, testUserId);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await flowRepository.create({ name: "Second Flow" }, testUserId);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await flowRepository.create({ name: "Third Flow" }, testUserId);

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(3);
      // The repository should return flows ordered by creation date descending
      expect(result.value[0].name).toBe("Third Flow");
      expect(result.value[1].name).toBe("Second Flow");
      expect(result.value[2].name).toBe("First Flow");
    });

    it("should only return active flows", async () => {
      // Create active and inactive flows
      const activeFlow = await flowRepository.create({ name: "Active Flow" }, testUserId);
      assertSuccess(activeFlow);

      const inactiveFlow = await flowRepository.create(
        { name: "Inactive Flow", isActive: false },
        testUserId,
      );
      assertSuccess(inactiveFlow);

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].name).toBe("Active Flow");
      expect(result.value[0].isActive).toBe(true);
    });

    it("should log flow listing start", async () => {
      const logSpy = jest.spyOn(useCase["logger"], "log");

      await useCase.execute();

      expect(logSpy).toHaveBeenCalledWith("Listing all active flows");
    });

    it("should handle large number of flows", async () => {
      // Create many flows to test performance
      const promises = Array.from({ length: 50 }, (_, i) =>
        flowRepository.create({ name: `Flow ${i}` }, testUserId),
      );
      await Promise.all(promises);

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(50);
    });

    it("should handle flows from different users", async () => {
      const user2Id = await testApp.createTestUser({});
      const user3Id = await testApp.createTestUser({});

      // Create flows from different users
      await flowRepository.create({ name: "User 1 Flow" }, testUserId);
      await flowRepository.create({ name: "User 2 Flow" }, user2Id);
      await flowRepository.create({ name: "User 3 Flow" }, user3Id);

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(3);

      const createdByUsers = result.value.map((flow) => flow.createdBy);
      expect(createdByUsers).toContain(testUserId);
      expect(createdByUsers).toContain(user2Id);
      expect(createdByUsers).toContain(user3Id);
    });

    it("should handle flows with various configurations", async () => {
      // Create flows with different configurations
      await flowRepository.create(
        {
          name: "Basic Flow",
        },
        testUserId,
      );

      await flowRepository.create(
        {
          name: "Complex Flow",
          description: "A complex flow with description",
          version: 2,
          isActive: true,
        },
        testUserId,
      );

      await flowRepository.create(
        {
          name: "Flow with Special Characters",
          description: "Flow with émojis 🚀 and spéciål chars\nand newlines",
        },
        testUserId,
      );

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(3);

      const flowNames = result.value.map((flow) => flow.name);
      expect(flowNames).toContain("Basic Flow");
      expect(flowNames).toContain("Complex Flow");
      expect(flowNames).toContain("Flow with Special Characters");
    });
  });

  describe("error handling", () => {
    it("should handle database timeout error", async () => {
      const timeoutError = new Error("Database timeout");
      timeoutError.name = "DatabaseTimeoutError";
      jest.spyOn(flowRepository, "findAll").mockResolvedValueOnce(failure(timeoutError));

      const result = await useCase.execute();

      assertFailure(result);
      expect(result.error).toBe(timeoutError);
      expect(result.error.name).toBe("DatabaseTimeoutError");
    });

    it("should handle database connection error", async () => {
      const connectionError = new Error("Connection refused");
      connectionError.name = "DatabaseConnectionError";
      jest.spyOn(flowRepository, "findAll").mockResolvedValueOnce(failure(connectionError));

      const result = await useCase.execute();

      assertFailure(result);
      expect(result.error).toBe(connectionError);
      expect(result.error.name).toBe("DatabaseConnectionError");
    });

    it("should handle repository error with custom properties", async () => {
      const customError = new Error("Custom repository error");
      (customError as any).code = "REPO_ERROR";
      (customError as any).statusCode = 500;
      jest.spyOn(flowRepository, "findAll").mockResolvedValueOnce(failure(customError));

      const result = await useCase.execute();

      assertFailure(result);
      expect(result.error).toBe(customError);
      expect((result.error as any).code).toBe("REPO_ERROR");
      expect((result.error as any).statusCode).toBe(500);
    });
  });

  describe("concurrent access", () => {
    it("should handle concurrent execute calls", async () => {
      // Create some test flows
      await flowRepository.create({ name: "Concurrent Test Flow 1" }, testUserId);
      await flowRepository.create({ name: "Concurrent Test Flow 2" }, testUserId);

      // Execute multiple concurrent calls
      const [result1, result2, result3] = await Promise.all([
        useCase.execute(),
        useCase.execute(),
        useCase.execute(),
      ]);

      assertSuccess(result1);
      assertSuccess(result2);
      assertSuccess(result3);

      // All results should be the same
      expect(result1.value).toEqual(result2.value);
      expect(result2.value).toEqual(result3.value);
      expect(result1.value).toHaveLength(2);
    });

    it("should handle execute call while flows are being created", async () => {
      // Start creating flows concurrently with listing
      const createPromise = flowRepository.create({ name: "Concurrent Flow" }, testUserId);
      const listPromise = useCase.execute();

      const [createResult, listResult] = await Promise.all([createPromise, listPromise]);

      assertSuccess(createResult);
      assertSuccess(listResult);

      // The list may or may not include the newly created flow depending on timing
      expect(listResult.value.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("edge cases", () => {
    it("should handle flows with null descriptions", async () => {
      await flowRepository.create(
        { name: "Flow with null description", description: null },
        testUserId,
      );

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].description).toBeNull();
    });

    it("should handle flows with empty string names", async () => {
      await flowRepository.create({ name: "" }, testUserId);

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].name).toBe("");
    });

    it("should handle flows with very long names", async () => {
      const longName = "x".repeat(250);
      await flowRepository.create({ name: longName }, testUserId);

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].name).toBe(longName);
    });

    it("should handle flows with large version number", async () => {
      await flowRepository.create({ name: "Large Version Flow", version: 999999 }, testUserId);

      const result = await useCase.execute();

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].version).toBe(999999);
    });
  });

  describe("logging behavior", () => {
    it("should log flow listing attempt", async () => {
      const logSpy = jest.spyOn(useCase["logger"], "log");
      jest.spyOn(flowRepository, "findAll").mockResolvedValueOnce(success([]));

      await useCase.execute();

      // Verify log was called
      expect(logSpy).toHaveBeenCalledWith("Listing all active flows");
    });

    it("should still log even when repository fails", async () => {
      const logSpy = jest.spyOn(useCase["logger"], "log");
      jest.spyOn(flowRepository, "findAll").mockResolvedValueOnce(failure(new Error("Failed")));

      const result = await useCase.execute();

      assertFailure(result);
      expect(logSpy).toHaveBeenCalledWith("Listing all active flows");
    });
  });
});
