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
import { GetExperimentDashboardUseCase } from "./get-experiment-dashboard";

describe("GetExperimentDashboardUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentDashboardUseCase;
  let experimentDashboardRepository: ExperimentDashboardRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetExperimentDashboardUseCase);
    experimentDashboardRepository = testApp.module.get(ExperimentDashboardRepository);
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

    it("should successfully get a dashboard", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(experiment.id)),
      );

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: dashboardId,
        experimentId: experiment.id,
        name: "Test Dashboard",
      });
    });

    it("should allow access to a public experiment's dashboard for non-members", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Public Experiment",
        userId: testUserId,
        visibility: "public",
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(experiment.id)),
      );

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.id).toBe(dashboardId);
    });

    it("should fail when dashboard findById returns failure", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to retrieve experiment dashboard");
    });

    it("should fail when dashboard findById returns success with null", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(success(null));

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Dashboard with ID ${dashboardId} not found`);
    });

    it("should fail when dashboard belongs to a different experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });
      const otherExperimentId = faker.string.uuid();

      vi.spyOn(experimentDashboardRepository, "findById").mockResolvedValue(
        success(buildDashboard(otherExperimentId)),
      );

      const result = await useCase.execute(experiment.id, dashboardId, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(
        `Dashboard with ID ${dashboardId} not found in this experiment`,
      );
    });
  });
});
