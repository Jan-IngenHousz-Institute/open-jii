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
  ExperimentDashboardDto,
  UpdateExperimentDashboardDto,
} from "../../../core/models/experiment-dashboards.model";
import { ExperimentDashboardRepository } from "../../../core/repositories/experiment-dashboard.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { UpdateExperimentDashboardUseCase } from "./update-experiment-dashboard";

describe("UpdateExperimentDashboardUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateExperimentDashboardUseCase;
  let experimentDashboardRepository: ExperimentDashboardRepository;
  let experimentRepository: ExperimentRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateExperimentDashboardUseCase);
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
      name: "Original Dashboard",
      description: "Original Description",
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      widgets: [],
      createdBy: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    const mockUpdateRequest: UpdateExperimentDashboardDto = {
      name: "Updated Dashboard",
      description: "Updated Description",
    };

    it("should successfully update a dashboard", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const existing = buildDashboard(experiment.id);

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(success(existing));

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
      );

      const updated: ExperimentDashboardDto = {
        ...existing,
        name: "Updated Dashboard",
        description: "Updated Description",
        updatedAt: new Date(),
      };

      const updateSpy = vi
        .spyOn(experimentDashboardRepository, "update")
        .mockResolvedValue(success([updated]));

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: dashboardId,
        name: "Updated Dashboard",
        description: "Updated Description",
      });
      expect(updateSpy).toHaveBeenCalledWith(dashboardId, mockUpdateRequest);
    });

    it("should allow admin to update dashboard even if not the creator", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const otherUserId = faker.string.uuid();
      const existing = buildDashboard(experiment.id, { createdBy: otherUserId });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(success(existing));

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "update").mockResolvedValue(
        success([{ ...existing, name: "Updated Dashboard" }]),
      );

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.name).toBe("Updated Dashboard");
    });

    it("should handle empty update successfully", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const existing = buildDashboard(experiment.id);

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(success(existing));

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "update").mockResolvedValue(success([existing]));

      const result = await useCase.execute(experiment.id, dashboardId, {}, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.id).toBe(dashboardId);
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

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

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

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

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

      const result = await useCase.execute(
        fakeExperimentId,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${fakeExperimentId} not found`);
    });

    it("should fail when the dashboard belongs to a different experiment than the URL", async () => {
      // The URL points at a valid, accessible experiment, but the resolved
      // dashboard belongs to another one. Mismatch must 404 only after the
      // access check has already passed, so unauthorized callers cannot
      // distinguish "exists elsewhere" from "does not exist".
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

      const updateSpy = vi.spyOn(experimentDashboardRepository, "update");

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toBe(
        `Dashboard with ID ${dashboardId} not found in this experiment`,
      );
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("should fail when user does not have archive access", async () => {
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
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when repository update returns empty array", async () => {
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

      vi.spyOn(experimentDashboardRepository, "update").mockResolvedValue(success([]));

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to update dashboard");
    });

    it("should propagate repository update failure", async () => {
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

      vi.spyOn(experimentDashboardRepository, "update").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Database error");
    });

    it("should forbid updating dashboards of archived experiments", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Archived Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(experiment.id)),
      );

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: { ...experiment, status: "archived" },
          hasAccess: true,
          hasArchiveAccess: false,
          isAdmin: true,
        }),
      );

      const result = await useCase.execute(
        experiment.id,
        dashboardId,
        mockUpdateRequest,
        testUserId,
      );

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("You do not have access to this experiment");
    });
  });
});
