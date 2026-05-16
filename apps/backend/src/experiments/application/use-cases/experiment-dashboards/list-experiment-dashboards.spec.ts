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
import { ListExperimentDashboardsUseCase } from "./list-experiment-dashboards";

describe("ListExperimentDashboardsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListExperimentDashboardsUseCase;
  let experimentRepository: ExperimentRepository;
  let experimentDashboardRepository: ExperimentDashboardRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListExperimentDashboardsUseCase);
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
    const buildDashboard = (
      experimentId: string,
      overrides: Partial<ExperimentDashboardDto> = {},
    ): ExperimentDashboardDto => ({
      id: faker.string.uuid(),
      experimentId,
      name: "Dashboard",
      description: null,
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      widgets: [],
      createdBy: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it("should successfully list dashboards", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const dashboards: ExperimentDashboardDto[] = [
        buildDashboard(experiment.id, { name: "Dashboard 1" }),
        buildDashboard(experiment.id, { name: "Dashboard 2" }),
      ];

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      const listSpy = vi
        .spyOn(experimentDashboardRepository, "listDashboards")
        .mockResolvedValue(success(dashboards));

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toMatchObject({ name: "Dashboard 1" });
      expect(result.value[1]).toMatchObject({ name: "Dashboard 2" });
      expect(listSpy).toHaveBeenCalledWith(experiment.id);
    });

    it("should return empty array when there are no dashboards", async () => {
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

      vi.spyOn(experimentDashboardRepository, "listDashboards").mockResolvedValue(success([]));

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should allow listing dashboards of a public experiment for non-members", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Public Experiment",
        userId: testUserId,
        visibility: "public",
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: { ...experiment, visibility: "public" },
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      vi.spyOn(experimentDashboardRepository, "listDashboards").mockResolvedValue(
        success([buildDashboard(experiment.id)]),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
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

      const result = await useCase.execute(nonExistentExperimentId, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${nonExistentExperimentId} not found`);
    });

    it("should fail when user does not have access to a private experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Private Experiment",
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

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when repository returns failure", async () => {
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

      vi.spyOn(experimentDashboardRepository, "listDashboards").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to retrieve experiment dashboards");
    });
  });
});
