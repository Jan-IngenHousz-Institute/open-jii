import { faker } from "@faker-js/faker";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type {
  CreateExperimentDashboardDto,
  ExperimentDashboardDto,
} from "../../../core/models/experiment-dashboards.model";
import { ExperimentDashboardRepository } from "../../../core/repositories/experiment-dashboard.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { CreateExperimentDashboardUseCase } from "./create-experiment-dashboard";

describe("CreateExperimentDashboardUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentDashboardUseCase;
  let experimentRepository: ExperimentRepository;
  let experimentDashboardRepository: ExperimentDashboardRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentDashboardUseCase);
    experimentRepository = testApp.module.get(ExperimentRepository);
    experimentDashboardRepository = testApp.module.get(ExperimentDashboardRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    const mockRequest: CreateExperimentDashboardDto = {
      name: "Test Dashboard",
      description: "Test Description",
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      widgets: [],
    };

    const dashboardId = faker.string.uuid();

    const buildDashboard = (
      experimentId: string,
      overrides: Partial<ExperimentDashboardDto> = {},
    ): ExperimentDashboardDto => ({
      id: dashboardId,
      experimentId,
      name: mockRequest.name,
      description: mockRequest.description ?? null,
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      widgets: [],
      createdBy: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it("should successfully create a dashboard", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const checkAccessSpy = vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      const createSpy = vi
        .spyOn(experimentDashboardRepository, "create")
        .mockResolvedValue(success([buildDashboard(experiment.id)]));

      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: dashboardId,
        experimentId: experiment.id,
        name: mockRequest.name,
        createdBy: testUserId,
      });

      expect(checkAccessSpy).toHaveBeenCalledWith(experiment.id, testUserId);
      expect(createSpy).toHaveBeenCalledWith(experiment.id, mockRequest, testUserId);
    });

    it("should fail when experiment does not exist", async () => {
      const nonExistentExperimentId = faker.string.uuid();

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: null,
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      const result = await useCase.execute(nonExistentExperimentId, mockRequest, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${nonExistentExperimentId} not found`);
    });

    it("should fail when user does not have archive access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when user has no access at all", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when repository returns empty array", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "create").mockResolvedValue(success([]));

      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to create dashboard");
    });

    it("should propagate repository failure", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "create").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Database error");
    });

    it("should forbid creating dashboard in archived experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Archived Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: { ...experiment, status: "archived" },
          hasAccess: true,
          hasArchiveAccess: false,
          isAdmin: true,
        }),
      );

      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("You do not have access to this experiment");
    });
  });
});
