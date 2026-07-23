import { faker } from "@faker-js/faker";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentDashboardDto } from "../../../core/models/experiment-dashboards.model";
import { ExperimentDashboardRepository } from "../../../core/repositories/experiment-dashboard.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { DeleteExperimentDashboardUseCase } from "./delete-experiment-dashboard";

describe("DeleteExperimentDashboardUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentDashboardUseCase;
  let experimentDashboardRepository: ExperimentDashboardRepository;
  let experimentRepository: ExperimentRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentDashboardUseCase);
    experimentDashboardRepository = testApp.module.get(ExperimentDashboardRepository);
    experimentRepository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    const dashboardId = faker.string.uuid();

    const buildDashboard = (
      experimentId: string,
      overrides: Partial<ExperimentDashboardDto> = {},
    ): ExperimentDashboardDto => ({
      id: dashboardId,
      experimentId,
      name: "Test Dashboard",
      description: null,
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      widgets: [],
      createdBy: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it("should successfully delete a dashboard", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(experiment.id)),
      );

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
      );

      const deleteSpy = vi
        .spyOn(experimentDashboardRepository, "delete")
        .mockResolvedValue(success(undefined));

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();
      expect(deleteSpy).toHaveBeenCalledWith(dashboardId);
    });

    it("should allow an admin to delete a dashboard they did not create", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(experiment.id, { createdBy: faker.string.uuid() })),
      );

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "delete").mockResolvedValue(success(undefined));

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();
    });

    it("should fail when dashboard findById returns failure", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Database error");
    });

    it("should fail when dashboard findById returns success with null", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(success(null));

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Dashboard with ID ${dashboardId} not found`);
    });

    it("should fail when the URL experiment does not exist", async () => {
      const fakeExperimentId = faker.string.uuid();

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: null,
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      const result = await useCase.execute(fakeExperimentId, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${fakeExperimentId} not found`);
    });

    it("should fail when the dashboard belongs to a different experiment than the URL", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });
      const otherExperimentId = faker.string.uuid();

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(otherExperimentId)),
      );

      const deleteSpy = vi.spyOn(experimentDashboardRepository, "delete");

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toBe(
        `Dashboard with ID ${dashboardId} not found in this experiment`,
      );
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it("should fail when repository delete operation fails", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(experiment.id)),
      );

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "delete").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to delete dashboard");
    });

    it("should forbid deletion in archived experiments", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Archived Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(experiment.id)),
      );

      vi.spyOn(experimentRepository, "findOne").mockResolvedValue(
        success({ ...experiment, status: "archived" }),
      );

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Cannot modify an archived experiment");
    });
  });
});
