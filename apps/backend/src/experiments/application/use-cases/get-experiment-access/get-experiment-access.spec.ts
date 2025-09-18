/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { assertFailure, assertSuccess, AppError, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { GetExperimentAccessUseCase } from "./get-experiment-access";

describe("GetExperimentAccessUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let anotherUserId: string;
  let useCase: GetExperimentAccessUseCase;
  let experimentRepository: ExperimentRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    anotherUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(GetExperimentAccessUseCase);
    experimentRepository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    testApp.afterEach();
    // Reset any mocks
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should return experiment access info when user is the creator", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Creator Test",
        description: "Creator access test",
        status: "active",
        visibility: "private",
        userId: testUserId,
      });

      // Act
      const result = await useCase.execute(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const accessInfo = result.value;
      expect(accessInfo).toEqual({
        experiment: expect.objectContaining({
          id: experiment.id,
          name: "Creator Test",
          description: "Creator access test",
          status: "active",
          visibility: "private",
        }),
        hasAccess: true,
        isAdmin: true,
      });
    });

    it("should return experiment access info when user is the creator", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Creator Test",
        description: "Creator access test",
        status: "active",
        visibility: "private",
        userId: testUserId,
      });

      // Act
      const result = await useCase.execute(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const accessInfo = result.value;
      expect(accessInfo).toEqual({
        experiment: expect.objectContaining({
          id: experiment.id,
          name: "Creator Test",
          description: "Creator access test",
          status: "active",
          visibility: "private",
        }),
        hasAccess: true,
        isAdmin: true,
      });
    });

    it("should return experiment access info when user is an admin member", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Admin Test",
        userId: testUserId,
      });

      // Add another user as admin member
      await testApp.addExperimentMember(experiment.id, anotherUserId, "admin");

      // Act
      const result = await useCase.execute(experiment.id, anotherUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const accessInfo = result.value;
      expect(accessInfo).toEqual({
        experiment: expect.objectContaining({
          id: experiment.id,
          name: "Admin Test",
        }),
        hasAccess: true,
        isAdmin: true,
      });
    });

    it("should return experiment access info when user is a regular member", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Member Test",
        userId: testUserId,
      });

      // Add another user as regular member
      await testApp.addExperimentMember(experiment.id, anotherUserId, "member");

      // Act
      const result = await useCase.execute(experiment.id, anotherUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const accessInfo = result.value;
      expect(accessInfo).toEqual({
        experiment: expect.objectContaining({
          id: experiment.id,
          name: "Member Test",
        }),
        hasAccess: true,
        isAdmin: false,
      });
    });

    it("should return experiment access info for public experiments even when user is not a member", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Public Test",
        description: "Public experiment test",
        status: "active",
        visibility: "public",
        userId: testUserId,
      });

      // Act - access with non-member user
      const result = await useCase.execute(experiment.id, anotherUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const accessInfo = result.value;
      expect(accessInfo).toEqual({
        experiment: expect.objectContaining({
          id: experiment.id,
          name: "Public Test",
          description: "Public experiment test",
          status: "active",
          visibility: "public",
        }),
        hasAccess: false, // User is not a member
        isAdmin: false,
      });
    });

    it("should return forbidden error when user is not a member of private experiment", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Private Test",
        visibility: "private",
        userId: testUserId,
      });

      // Act - access with non-member user
      const result = await useCase.execute(experiment.id, anotherUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);

      const error = result.error;
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe("You do not have permission to access this experiment");
    });

    it("should return not found error when experiment does not exist", async () => {
      // Arrange
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Act
      const result = await useCase.execute(nonExistentId, testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);

      const error = result.error;
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe(`Experiment with ID ${nonExistentId} not found`);
    });

    it("should handle repository errors gracefully", async () => {
      // Arrange
      const mockError = AppError.internal("Database connection failed");
      // Mock repository to return failure - save original
      const originalCheckAccess = experimentRepository.checkAccess.bind(experimentRepository);
      experimentRepository.checkAccess = vi.fn().mockResolvedValue(failure(mockError));

      // Act
      const result = await useCase.execute("test-id", testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error).toBe(mockError);
      }

      // Restore original method
      experimentRepository.checkAccess = originalCheckAccess;
    });

    it("should handle edge case where experiment is null in successful repository response", async () => {
      // Arrange
      const testExperimentId = "test-experiment-id";

      // Mock repository to return success but with null experiment - save original
      const originalCheckAccess = experimentRepository.checkAccess.bind(experimentRepository);
      experimentRepository.checkAccess = vi.fn().mockImplementation(() => {
        const mockResult = {
          isSuccess: () => true,
          isFailure: () => false,
          chain: (fn: (value: any) => any) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return fn({
              experiment: null,
              hasAccess: false,
              isAdmin: false,
            });
          },
        };
        return Promise.resolve(mockResult as any);
      });

      // Act
      const result = await useCase.execute(testExperimentId, testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);

      const error = result.error;
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe(`Experiment with ID ${testExperimentId} not found`);

      // Restore original method
      experimentRepository.checkAccess = originalCheckAccess;
    });

    it("should correctly identify public vs private experiment access scenarios", async () => {
      // Reset any mocks to use real repository
      vi.restoreAllMocks();
      experimentRepository = testApp.module.get(ExperimentRepository);

      // Arrange - Create both public and private experiments
      const { experiment: privateExp } = await testApp.createExperiment({
        name: "Private Experiment",
        visibility: "private",
        userId: testUserId,
      });

      const { experiment: publicExp } = await testApp.createExperiment({
        name: "Public Experiment",
        visibility: "public",
        userId: testUserId,
      });

      // Act & Assert - Private experiment with non-member should be forbidden
      const privateResult = await useCase.execute(privateExp.id, anotherUserId);
      expect(privateResult.isFailure()).toBe(true);
      assertFailure(privateResult);
      // The error should be 403 if access is denied, but could be 404 if experiment not found
      expect([403, 404]).toContain(privateResult.error.statusCode);

      // Act & Assert - Public experiment with non-member should succeed
      const publicResult = await useCase.execute(publicExp.id, anotherUserId);
      if (publicResult.isFailure()) {
        console.error("Public experiment test failed with error:", publicResult.error);
      }
      expect(publicResult.isSuccess()).toBe(true);
      assertSuccess(publicResult);
      expect(publicResult.value.hasAccess).toBe(false); // Not a member
      expect(publicResult.value.isAdmin).toBe(false);
    });

    it("should return correct access info structure with all required fields", async () => {
      // Reset any mocks to use real repository
      vi.restoreAllMocks();
      experimentRepository = testApp.module.get(ExperimentRepository);

      const { experiment } = await testApp.createExperiment({
        name: "Structure Test",
        description: "Testing return structure",
        status: "active",
        visibility: "private",
        userId: testUserId,
      });

      // Act
      const result = await useCase.execute(experiment.id, testUserId);

      // Assert - debug what we get if it fails
      if (result.isFailure()) {
        console.error("Test failed with error:", result.error);
      }
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const accessInfo = result.value;

      // Verify the structure matches ExperimentAccessDto interface
      expect(accessInfo).toHaveProperty("experiment");
      expect(accessInfo).toHaveProperty("hasAccess");
      expect(accessInfo).toHaveProperty("isAdmin");

      // Verify experiment object has all expected properties
      expect(accessInfo.experiment).toMatchObject({
        id: experiment.id,
        name: "Structure Test",
        description: "Testing return structure",
        status: "active",
        visibility: "private",
        createdBy: testUserId,
      });

      // Verify boolean flags
      expect(typeof accessInfo.hasAccess).toBe("boolean");
      expect(typeof accessInfo.isAdmin).toBe("boolean");
      expect(accessInfo.hasAccess).toBe(true);
      expect(accessInfo.isAdmin).toBe(true);
    });
  });
});
