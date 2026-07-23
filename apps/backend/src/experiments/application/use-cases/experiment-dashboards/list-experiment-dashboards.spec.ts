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
import { ListExperimentDashboardsUseCase } from "./list-experiment-dashboards";

describe("ListExperimentDashboardsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListExperimentDashboardsUseCase;
  let experimentDashboardRepository: ExperimentDashboardRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListExperimentDashboardsUseCase);
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

      const listSpy = vi
        .spyOn(experimentDashboardRepository, "listDashboards")
        .mockResolvedValue(success(dashboards));

      const result = await useCase.execute(experiment.id, testUserId, 50, 0);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toMatchObject({ name: "Dashboard 1" });
      expect(result.value[1]).toMatchObject({ name: "Dashboard 2" });
      expect(listSpy).toHaveBeenCalledWith(experiment.id, 50, 0);
    });

    it("should forward custom limit and offset to the repository", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const listSpy = vi
        .spyOn(experimentDashboardRepository, "listDashboards")
        .mockResolvedValue(success([]));

      await useCase.execute(experiment.id, testUserId, 10, 20);

      expect(listSpy).toHaveBeenCalledWith(experiment.id, 10, 20);
    });

    it("should return empty array when there are no dashboards", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "listDashboards").mockResolvedValue(success([]));

      const result = await useCase.execute(experiment.id, testUserId, 50, 0);

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

      vi.spyOn(experimentDashboardRepository, "listDashboards").mockResolvedValue(
        success([buildDashboard(experiment.id)]),
      );

      const result = await useCase.execute(experiment.id, testUserId, 50, 0);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
    });

    it("should fail when repository returns failure", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "listDashboards").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const result = await useCase.execute(experiment.id, testUserId, 50, 0);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to retrieve experiment dashboards");
    });
  });
});
